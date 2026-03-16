import { Routes } from '@angular/router';

import { PublicLayoutComponent }  from './core/layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './core/layouts/private-layout/private-layout.component';

import { HomeComponent }     from './features/home/home.component';
import { LoginComponent }    from './features/auth/login/login.component';
import { RegistroComponent } from './features/auth/registro/registro.component';
import { GruposComponent }   from './features/grupos/grupos.component';
import { VideosComponent }   from './features/videos/videos.component';
import { authGuard }         from './core/guards/auth.guard';

export const routes: Routes = [

  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '',         component: HomeComponent,     pathMatch: 'full' },
      { path: 'home',     component: HomeComponent },
      { path: 'login',    component: LoginComponent },
      { path: 'registro', component: RegistroComponent },
    ],
  },

  {
    path: '',
    component: PrivateLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'videos', component: VideosComponent },
      { path: 'grupos', component: GruposComponent },
    ],
  },

];
