import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GroupService, Group } from '../../services/group.service';
import { switchMap, of } from 'rxjs';

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

  /** Estado del sidebar: colapsado o expandido. */
  readonly sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  /** Últimos grupos accedidos por el usuario (máx. 3). */
  gruposRecientes: Group[] = [];

  private readonly router       = inject(Router);
  private readonly groupService = inject(GroupService);

  constructor() {
    this.actualizarHeader(this.router.url);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(e => this.actualizarHeader(e.urlAfterRedirects));

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
          // Fallback: ordena por fechaCreacion DESC y toma los 3 más nuevos
          this.gruposRecientes = grupos
            .slice()
            .sort((a, b) => (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? ''))
            .slice(0, 3);
        },
        error: () => { /* silencioso — sección opcional */ },
      });
  }

  /** Primera(s) letra(s) del nombre del grupo para el avatar pill. */
  grupoInicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private actualizarHeader(url: string): void {
    if      (url.startsWith('/dashboard'))             this.pageTitle = 'Dashboard';
    else if (url.startsWith('/mi-espacio/videos'))     this.pageTitle = 'Mis Vídeos';
    else if (url.startsWith('/mi-espacio/grupos'))     this.pageTitle = 'Mis Grupos';
    else if (url.startsWith('/mi-espacio/analiticas')) this.pageTitle = 'Analíticas';
    else if (url.startsWith('/compartido'))            this.pageTitle = 'Vídeos Disponibles';
    else if (url.startsWith('/perfil'))                this.pageTitle = 'Mi Perfil';
    else if (url.startsWith('/ajustes'))               this.pageTitle = 'Ajustes';
    else                                               this.pageTitle = 'Lockstrm';
  }
}
