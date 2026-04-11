import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  // CommonModule eliminado: usamos @if nativo de Angular 17+
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './private-layout.component.html',
  styleUrl:    './private-layout.component.css',
})
export class PrivateLayoutComponent {

  /** Título dinámico de la cabecera, sincronizado con la ruta activa. */
  pageTitle = 'Dashboard';

  // Acceso directo al signal de sólo lectura expuesto por AuthService.
  // Como PrivateLayout sólo se monta tras pasar el authGuard, currentUser()
  // siempre tiene valor; no hace falta lógica defensiva en la plantilla.
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  readonly currentUser         = this.authService.currentUser;

  constructor() {
    // Sincroniza el título con la URL en el momento de montar el componente
    this.actualizarHeader(this.router.url);

    // Se actualiza en cada navegación; takeUntilDestroyed limpia la suscripción
    // automáticamente cuando Angular destruye el componente
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(e => this.actualizarHeader(e.urlAfterRedirects));
  }

  cerrarSesion(): void {
    this.authService.logout(); // limpia signal + localStorage + navega a /
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private actualizarHeader(url: string): void {
    if      (url.startsWith('/dashboard'))            this.pageTitle = 'Dashboard';
    else if (url.startsWith('/mi-espacio/videos'))    this.pageTitle = 'Mis Vídeos';
    else if (url.startsWith('/mi-espacio/grupos'))    this.pageTitle = 'Mis Grupos';
    else if (url.startsWith('/compartido'))           this.pageTitle = 'Vídeos Disponibles';
    else if (url.startsWith('/ajustes'))              this.pageTitle = 'Ajustes';
    else                                              this.pageTitle = 'Lockstrm';
  }
}
