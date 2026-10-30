import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private auth = inject(AuthService);
  private theme = inject(ThemeService);
  protected readonly authState = this.auth.authState;
  protected readonly isDark = this.theme.isDark;
  protected readonly themePref = this.theme.preference;

  ngOnInit(): void {
    this.theme.init();
    // Detecta el resultado del callback OAuth al cargar.
    this.auth.handleRedirectResult();
  }

  toggleTheme(): void {
    this.theme.toggle();
  }

  login(): void {
    this.auth.login();
  }

  logout(): void {
    this.auth.logout();
  }
}
