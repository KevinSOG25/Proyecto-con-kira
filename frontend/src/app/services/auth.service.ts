import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'academicsync_auth';

interface AuthState {
  authenticated: boolean;
  email: string | null;
}

/**
 * Estado de autenticación con Google OAuth.
 * El flujo real ocurre en el backend (/auth/google -> callback -> redirect).
 * Aquí solo iniciamos la redirección y detectamos el resultado que el
 * backend anexa al FRONTEND_URL (?auth=success&email=...).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private state = signal<AuthState>(this.restore());

  /** Signal de solo lectura para las vistas. */
  readonly authState = this.state.asReadonly();

  /** Redirige al inicio del flujo OAuth del backend. */
  login(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state.set({ authenticated: false, email: null });
  }

  /**
   * Detecta ?auth=success&email=... en la URL tras volver del callback,
   * persiste el estado y limpia los parámetros de la URL.
   */
  handleRedirectResult(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      const email = params.get('email');
      const next: AuthState = { authenticated: true, email: email || null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.state.set(next);
      // Limpiar la query de la URL sin recargar.
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());
    }
  }

  private restore(): AuthState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as AuthState;
    } catch {
      /* ignore */
    }
    return { authenticated: false, email: null };
  }
}
