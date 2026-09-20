import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthClient } from './google-auth.client';
import { GoogleProfile } from './dto/google-token.dto';
import { UserTokens } from './entities/user-tokens.entity';

@Injectable()
export class AuthService {
  constructor(private readonly googleAuth: GoogleAuthClient) {}

  /** Genera la URL de consentimiento de Google. */
  getConsentUrl(state?: string): string {
    return this.googleAuth.generateAuthUrl(state);
  }

  /**
   * Completa el flujo OAuth: intercambia el code, obtiene el perfil
   * y persiste las credenciales del usuario.
   */
  async handleCallback(code: string): Promise<UserTokens> {
    const creds = await this.googleAuth.exchangeCode(code);
    if (!creds.access_token) {
      throw new UnauthorizedException('Google no devolvió un access_token.');
    }

    const profile = await this.fetchProfile(creds.access_token);
    return this.googleAuth.saveCredentials(profile.sub, profile.email, creds);
  }

  /** Obtiene el perfil (sub + email) usando el endpoint userinfo de OAuth2. */
  private async fetchProfile(accessToken: string): Promise<GoogleProfile> {
    const client = this.googleAuth.createBaseClient();
    client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    if (!data.id) {
      throw new UnauthorizedException('No se pudo obtener el perfil de Google.');
    }
    return { sub: data.id, email: data.email ?? undefined };
  }
}
