import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {

  private authService  = inject(AuthService);
  readonly currentUser = this.authService.currentUser;

  cerrarSesion(): void {
    this.authService.logout();
  }

  getAvatarSrc(): string | null {
    const url = this.currentUser()?.avatarUrl;
    return url ? `${environment.apiUrl}${url}` : null;
  }

  getInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';
    const n       = user.nombre?.[0]   ?? '';
    const a       = user.apellidos?.[0] ?? '';
    const initials = (n + a).toUpperCase();
    return initials || user.username?.[0]?.toUpperCase() || '?';
  }
}
