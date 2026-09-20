import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tokens de Google OAuth 2.0 para mantener la sesión de las Google APIs
 * (Calendar y Gmail). En una app monousuario solo habrá una fila,
 * pero se indexa por googleUserId para soportar varios usuarios.
 */
@Entity('user_tokens')
export class UserTokens {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID único de la cuenta de Google (sub del id_token). */
  @Column({ name: 'google_user_id', type: 'varchar', length: 255, unique: true })
  googleUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  /** El refresh_token solo se entrega en el primer consentimiento (access_type=offline). */
  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string;

  /** Scopes concedidos, separados por espacio. */
  @Column({ type: 'text', nullable: true })
  scope: string;

  @Column({ name: 'token_type', type: 'varchar', length: 50, nullable: true })
  tokenType: string;

  /** Momento de expiración del access_token. */
  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
