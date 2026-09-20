import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { UserTokens } from './entities/user-tokens.entity';
import { GoogleCredentials } from './dto/google-token.dto';

/**
 * Scopes solicitados a Google:
 * - calendar.events: crear/editar eventos (Fase 2).
 * - gmail.readonly: leer correos (Fase 3).
 * - openid/email/profile: identificar al usuario.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
];

/**
 * Cliente central de Google OAuth. Encapsula:
 *  - construcción del OAuth2Client base
 *  - persistencia de credenciales en UserTokens
 *  - obtención de un cliente ya autenticado (con refresh automático)
 */
@Injectable()
export class GoogleAuthClient {
  private readonly logger = new Logger(GoogleAuthClient.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserTokens)
    private readonly tokensRepo: Repository<UserTokens>,
  ) {}

  /** OAuth2Client sin credenciales, usado para el flujo de consentimiento. */
  createBaseClient(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno de Google OAuth (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI).',
      );
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /** URL de consentimiento. offline + consent garantiza recibir refresh_token. */
  generateAuthUrl(state?: string): string {
    const client = this.createBaseClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      include_granted_scopes: true,
      state,
    });
  }

  /** Intercambia el code por tokens. */
  async exchangeCode(code: string): Promise<GoogleCredentials> {
    const client = this.createBaseClient();
    const { tokens } = await client.getToken(code);
    return tokens as GoogleCredentials;
  }

  /**
   * Guarda o actualiza los tokens del usuario. El refresh_token solo llega
   * en el primer consentimiento; si no viene, conservamos el existente.
   */
  async saveCredentials(
    googleUserId: string,
    email: string | undefined,
    creds: GoogleCredentials,
  ): Promise<UserTokens> {
    let record = await this.tokensRepo.findOne({ where: { googleUserId } });
    if (!record) {
      record = this.tokensRepo.create({ googleUserId });
    }

    record.email = email ?? record.email;
    if (creds.access_token) record.accessToken = creds.access_token;
    if (creds.refresh_token) record.refreshToken = creds.refresh_token;
    if (creds.scope) record.scope = creds.scope;
    if (creds.token_type) record.tokenType = creds.token_type;
    record.expiryDate = creds.expiry_date
      ? new Date(creds.expiry_date)
      : record.expiryDate;

    return this.tokensRepo.save(record);
  }

  /**
   * Devuelve un OAuth2Client autenticado para el usuario indicado
   * (o el único usuario de la app si no se especifica). Refresca el
   * access_token automáticamente y persiste los tokens rotados.
   */
  async getAuthenticatedClient(googleUserId?: string): Promise<OAuth2Client> {
    const record = googleUserId
      ? await this.tokensRepo.findOne({ where: { googleUserId } })
      : await this.tokensRepo.findOne({ where: {}, order: { createdAt: 'ASC' } });

    if (!record || !record.refreshToken) {
      throw new UnauthorizedException(
        'No hay una sesión de Google válida. Autentícate en /auth/google.',
      );
    }

    const client = this.createBaseClient();
    client.setCredentials({
      access_token: record.accessToken,
      refresh_token: record.refreshToken,
      scope: record.scope,
      token_type: record.tokenType,
      expiry_date: record.expiryDate ? record.expiryDate.getTime() : undefined,
    });

    // Persistir automáticamente los tokens cuando la librería los rota.
    client.on('tokens', (tokens) => {
      this.saveCredentials(record.googleUserId, record.email, tokens).catch(
        (err) =>
          this.logger.error(
            `No se pudieron persistir los tokens refrescados: ${err.message}`,
          ),
      );
    });

    // Fuerza refresh si el access_token está por expirar (< 1 min).
    const soon = Date.now() + 60_000;
    if (!record.expiryDate || record.expiryDate.getTime() <= soon) {
      try {
        const { credentials } = await client.refreshAccessToken();
        await this.saveCredentials(
          record.googleUserId,
          record.email,
          credentials as GoogleCredentials,
        );
      } catch (err) {
        this.logger.error(`Fallo al refrescar el access_token: ${err.message}`);
        throw new UnauthorizedException(
          'La sesión de Google expiró. Vuelve a autenticarte.',
        );
      }
    }

    return client;
  }
}
