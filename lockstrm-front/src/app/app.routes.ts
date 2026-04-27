import { Routes } from '@angular/router';

import { AppShellComponent }        from './core/layouts/app-shell/app-shell.component';
import { PublicLayoutComponent }    from './core/layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent }   from './core/layouts/private-layout/private-layout.component';

import { HomeComponent }              from './features/home/home.component';
import { LoginComponent }             from './features/auth/login/login.component';
import { RegistroComponent }          from './features/auth/registro/registro.component';
import { DashboardComponent }         from './features/dashboard/dashboard.component';
import { VideosComponent }            from './features/videos/videos.component';
import { GruposComponent }            from './features/grupos/grupos.component';
import { GrupoDetalleComponent }      from './features/grupos/grupo-detalle/grupo-detalle.component';
import { AjustesComponent }           from './features/ajustes/ajustes.component';
import { PerfilComponent }            from './features/perfil/perfil.component';
import { AnaliticasComponent }        from './features/analiticas/analiticas.component';
import { AnaliticasVideoComponent }   from './features/analiticas/analiticas-video/analiticas-video.component';

import { authGuard }   from './core/guards/auth.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';

export const routes: Routes = [

  // ── ROOT SHELL — envuelve toda la aplicación ─────────────────────────────
  // AppShellComponent persiste en todas las rutas: muestra el navbar global
  // con el estado de autenticación reactivo y un <router-outlet> para el
  // contenido de cada página.
  {
    path: '',
    component: AppShellComponent,
    children: [

      // ── ÁREA PÚBLICA ────────────────────────────────────────────────────
      // PublicLayoutComponent es un wrapper mínimo (sólo padding + outlet).
      // El navbar ya lo gestiona AppShell.
      {
        path: '',
        component: PublicLayoutComponent,
        children: [
          { path: '',         component: HomeComponent, pathMatch: 'full' },
          { path: 'home',     redirectTo: '',           pathMatch: 'full' },
          { path: 'login',    component: LoginComponent,    canActivate: [noAuthGuard] },
          { path: 'registro', component: RegistroComponent, canActivate: [noAuthGuard] },
        ],
      },

      // ── ÁREA PRIVADA (auth requerida) ────────────────────────────────────
      // PrivateLayoutComponent aporta el sidebar de navegación y la cabecera
      // con el título de página. El guard redirige a /login si no hay sesión.
      {
        path: '',
        component: PrivateLayoutComponent,
        canActivate: [authGuard],
        children: [
          { path: 'dashboard', component: DashboardComponent },

          // Contexto Propietario: Mi Espacio
          {
            path: 'mi-espacio',
            children: [
              { path: '',           redirectTo: 'videos', pathMatch: 'full' },
              { path: 'videos',     component: VideosComponent },
              { path: 'grupos',     component: GruposComponent },
              { path: 'grupos/:id', component: GrupoDetalleComponent },
              { path: 'analiticas',          component: AnaliticasComponent },
              { path: 'analiticas/:idVideo', component: AnaliticasVideoComponent },
            ],
          },

          { path: 'perfil',  component: PerfilComponent },
          { path: 'ajustes', component: AjustesComponent },

          // Compatibilidad con rutas anteriores
          { path: 'videos', redirectTo: 'mi-espacio/videos', pathMatch: 'full' },
          { path: 'grupos', redirectTo: 'mi-espacio/grupos', pathMatch: 'full' },
        ],
      },

    ],
  },

];
