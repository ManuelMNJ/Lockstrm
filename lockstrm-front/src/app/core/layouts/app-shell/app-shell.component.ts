import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {

  /** Controla la visibilidad del dropdown de perfil. */
  readonly menuOpen = signal(false);

  constructor(readonly authService: AuthService) {}

  /**
   * Abre o cierra el menú de perfil.
   * stopPropagation evita que el clic burbujee hasta el backdrop y lo cierre
   * en el mismo ciclo.
   */
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  /**
   * Cierra el dropdown y delega en AuthService:
   *   • limpia el signal _currentUser → null
   *   • borra localStorage
   *   • navega a / (Homepage pública)
   */
  cerrarSesion(): void {
    this.menuOpen.set(false);
    this.authService.logout();
  }

  getAvatarSrc(): string | null {
    const url = this.authService.currentUser()?.avatarUrl;
    return url ? `${environment.apiUrl}${url}` : null;
  }

  getInitials(): string {
    const user = this.authService.currentUser();
    if (!user) return '?';
    const n       = user.nombre?.[0]   ?? '';
    const a       = user.apellidos?.[0] ?? '';
    const initials = (n + a).toUpperCase();
    return initials || user.username?.[0]?.toUpperCase() || '?';
  }
}
