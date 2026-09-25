import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrae un mensaje legible desde el error HTTP devuelto por NestJS.
 * Soporta:
 *  - { message: string }                     (excepciones simples)
 *  - { message: string[] }                   (errores de class-validator)
 *  - { error: string }                       (algunos formatos)
 *  - errores de red (status 0) sin cuerpo.
 */
export function extractHttpErrorMessage(
  err: unknown,
  fallback = 'Ocurrió un error inesperado.',
): string {
  if (err instanceof HttpErrorResponse) {
    // Error de red / backend inaccesible.
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }

    const body = err.error;

    // Cuerpo string directo.
    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (body && typeof body === 'object') {
      const msg = (body as { message?: unknown; error?: unknown }).message;
      // class-validator devuelve un arreglo de mensajes.
      if (Array.isArray(msg)) {
        return msg.join(' · ');
      }
      if (typeof msg === 'string' && msg.trim()) {
        return msg;
      }
      const errField = (body as { error?: unknown }).error;
      if (typeof errField === 'string' && errField.trim()) {
        return errField;
      }
    }

    // Último recurso: mensaje del propio HttpErrorResponse.
    if (err.message?.trim()) {
      return err.message;
    }
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }

  return fallback;
}
