import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

/**
 * Controla el tema claro/oscuro añadiendo la clase `.dark` al <html>.
 * Persiste la preferencia ('light' | 'dark' | 'system') en localStorage y
 * reacciona a los cambios del esquema del sistema cuando está en 'system'.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Preferencia elegida por el usuario. */
  readonly preference = signal<ThemePreference>(this.readStored());
  /** ¿El tema efectivo es oscuro? (resuelto). */
  readonly isDark = signal<boolean>(false);

  private mediaQuery?: MediaQueryList;

  /** Inicializa el tema lo antes posible (llamado desde el componente raíz). */
  init(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (this.preference() === 'system') this.apply();
      });
    }
    this.apply();
  }

  /** Cicla light -> dark -> system -> light. */
  cycle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(this.preference()) + 1) % order.length];
    this.setPreference(next);
  }

  /** Alterna directamente entre claro y oscuro (ignora 'system'). */
  toggle(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
    this.apply();
  }

  private readStored(): ThemePreference {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* ignore */
    }
    return 'system';
  }

  private resolveDark(): boolean {
    const pref = this.preference();
    if (pref === 'dark') return true;
    if (pref === 'light') return false;
    return this.mediaQuery?.matches ?? false;
  }

  private apply(): void {
    const dark = this.resolveDark();
    this.isDark.set(dark);
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  }
}
