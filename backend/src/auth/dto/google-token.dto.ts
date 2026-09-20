/**
 * Estructura de credenciales que devuelve google-auth-library al
 * intercambiar el code o refrescar el token.
 */
export interface GoogleCredentials {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
  id_token?: string | null;
}

/** Perfil básico extraído del id_token / userinfo. */
export interface GoogleProfile {
  sub: string;
  email?: string;
}
