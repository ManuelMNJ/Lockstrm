import { Routes } from '@angular/router';

import { AppShellComponent }        from './core/layouts/app-shell/app-shell.component';
import { PublicLayoutComponent }    from './core/layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent }   from './core/layouts/private-layout/private-layout.component';

import { HomeComponent }              from './features/home/home.component';
import { LoginComponent }             from './features/auth/login/login.component';
import { RegisterComponent }          from './features/auth/register/register.component';
import { ForgotPasswordComponent }   from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent }    from './features/auth/reset-password/reset-password.component';
import { DashboardComponent }         from './features/dashboard/dashboard.component';
import { VideosComponent }            from './features/videos/videos.component';
import { GroupsComponent }            from './features/groups/groups.component';
import { GroupDetailComponent }      from './features/groups/group-detail/group-detail.component';
import { SettingsComponent }           from './features/settings/settings.component';
import { ProfileComponent }            from './features/profile/profile.component';
import { AnalyticsComponent }        from './features/analytics/analytics.component';
import { VideoAnalyticsComponent }   from './features/analytics/video-analytics/video-analytics.component';
import { GroupAnalyticsComponent }   from './features/groups/group-detail/group-analytics/group-analytics.component';

import { authGuard }          from './core/guards/auth.guard';
import { noAuthGuard }        from './core/guards/no-auth.guard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';

export const routes: Routes = [

  {
    path: '',
    component: AppShellComponent,
    children: [

      {
        path: '',
        component: PublicLayoutComponent,
        children: [
          { path: '',         component: HomeComponent, pathMatch: 'full' },
          { path: 'home',     redirectTo: '',           pathMatch: 'full' },
          { path: 'login',                 component: LoginComponent,          canActivate: [noAuthGuard] },
          { path: 'registro',              component: RegisterComponent,        canActivate: [noAuthGuard] },
          { path: 'recuperar-contrasena',  component: ForgotPasswordComponent,  canActivate: [noAuthGuard] },
          { path: 'nueva-contrasena',      component: ResetPasswordComponent,   canActivate: [noAuthGuard] },
        ],
      },

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
              { path: 'grupos',     component: GroupsComponent },
              { path: 'grupos/:id', component: GroupDetailComponent },
              { path: 'analiticas',                              component: AnalyticsComponent },
              { path: 'analiticas/grupo/:idGrupo',              component: GroupAnalyticsComponent },
              { path: 'analiticas/grupo/:idGrupo/:idVideo',     component: VideoAnalyticsComponent },
              { path: 'analiticas/:idVideo',                    component: VideoAnalyticsComponent },
            ],
          },

          { path: 'perfil',  component: ProfileComponent, canDeactivate: [pendingChangesGuard] },
          { path: 'ajustes', component: SettingsComponent },

          // Compatibilidad con rutas anteriores
          { path: 'videos', redirectTo: 'mi-espacio/videos', pathMatch: 'full' },
          { path: 'grupos', redirectTo: 'mi-espacio/grupos', pathMatch: 'full' },
        ],
      },

    ],
  },

];
