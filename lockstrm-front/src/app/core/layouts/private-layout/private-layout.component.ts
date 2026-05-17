import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GroupService, Group } from '../../services/group.service';
import { switchMap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './private-layout.component.html',
  styleUrl:    './private-layout.component.css',
})
export class PrivateLayoutComponent {

  /** Título dinámico de la cabecera, sincronizado con la ruta activa. */
  pageTitle = 'Dashboard';

  /** Breadcrumbs para vistas de detalle. Vacío en vistas raíz. */
  breadcrumbs: { label: string; link?: string }[] = [];

  /** Estado del sidebar en desktop: colapsado (56px) o expandido (240px). */
  readonly sidebarCollapsed = signal(false);

  /** Estado del sidebar en móvil: drawer visible u oculto. */
  readonly mobileSidebarOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  /** Últimos grupos accedidos por el usuario (máx. 3). */
  readonly apiUrl = environment.apiUrl;
  readonly gruposRecientes = signal<Group[]>([]);

  private readonly router       = inject(Router);
  private readonly groupService = inject(GroupService);

  constructor() {
    this.actualizarHeader(this.router.url);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(e => {
        this.actualizarHeader(e.urlAfterRedirects);
        this.mobileSidebarOpen.set(false);
      });

    // 1º intenta los grupos por historial de reproducción (más reciente primero).
    // 2º si no hay historial aún, usa los grupos del usuario ordenados por
    //    fecha de creación descendente como fallback visible desde el inicio.
    this.groupService.obtenerGruposRecientes(3)
      .pipe(
        switchMap(recientes =>
          recientes.length > 0
            ? of(recientes)
            : this.groupService.obtenerMisGrupos()
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (grupos) => {
          this.gruposRecientes.set(
            grupos
              .slice()
              .sort((a, b) => (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? ''))
              .slice(0, 3)
          );
        },
        error: () => { /* silencioso — sección opcional */ },
      });
  }

  /** Primera(s) letra(s) del nombre del grupo para el avatar pill. */
  grupoInicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase();
  }

  private actualizarHeader(url: string): void {
    const cleanUrl = url.split('?')[0];

    if (cleanUrl.startsWith('/dashboard')) {
      this.pageTitle = 'Dashboard'; this.breadcrumbs = [];
    } else if (/^\/mi-espacio\/grupos\/\d+/.test(cleanUrl)) {
      this.pageTitle = 'Detalle de grupo';
      this.breadcrumbs = [{ label: 'Mis Grupos', link: '/mi-espacio/grupos' }];
    } else if (cleanUrl.startsWith('/mi-espacio/grupos')) {
      this.pageTitle = 'Mis Grupos'; this.breadcrumbs = [];
    } else if (/^\/mi-espacio\/analiticas\/grupo\/\d+\/\d+/.test(cleanUrl)) {
      this.pageTitle = 'Analíticas de vídeo';
      this.breadcrumbs = [{ label: 'Analíticas', link: '/mi-espacio/analiticas' }];
    } else if (/^\/mi-espacio\/analiticas\/grupo\/\d+/.test(cleanUrl)) {
      this.pageTitle = 'Analíticas de grupo';
      this.breadcrumbs = [{ label: 'Analíticas', link: '/mi-espacio/analiticas' }];
    } else if (/^\/mi-espacio\/analiticas\/\d+/.test(cleanUrl)) {
      this.pageTitle = 'Analíticas de vídeo';
      this.breadcrumbs = [{ label: 'Analíticas', link: '/mi-espacio/analiticas' }];
    } else if (cleanUrl.startsWith('/mi-espacio/analiticas')) {
      this.pageTitle = 'Analíticas'; this.breadcrumbs = [];
    } else if (cleanUrl.startsWith('/mi-espacio/videos')) {
      this.pageTitle = 'Mis Vídeos'; this.breadcrumbs = [];
    } else if (cleanUrl.startsWith('/compartido')) {
      this.pageTitle = 'Vídeos Disponibles'; this.breadcrumbs = [];
    } else if (cleanUrl.startsWith('/perfil')) {
      this.pageTitle = 'Mi Perfil'; this.breadcrumbs = [];
    } else if (cleanUrl.startsWith('/ajustes')) {
      this.pageTitle = 'Ajustes'; this.breadcrumbs = [];
    } else {
      this.pageTitle = 'Lockstrm'; this.breadcrumbs = [];
    }
  }
}
