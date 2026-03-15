// =============================================================================
// Lockstrm — Rutas de la aplicación
// app.routes.ts
//
// Arquitectura de rutas basada en dos Layout Components padre:
//
//  ZONA PÚBLICA  (path: '')  → PublicLayoutComponent
//  ┌─────────────────────────────────────────────────────────┐
//  │  /          → HomeComponent      (landing page)        │
//  │  /home      → HomeComponent      (alias)               │
//  │  /login     → LoginComponent                           │
//  │  /registro  → RegistroComponent                        │
//  └─────────────────────────────────────────────────────────┘
//    Sin sidebar. Muestra nav bar pública con logo + CTAs.
//
//  ZONA PRIVADA  (path: '')  → PrivateLayoutComponent
//  ┌─────────────────────────────────────────────────────────┐
//  │  /videos    → VideosComponent                          │
//  │  /grupos    → GruposComponent                          │
//  └─────────────────────────────────────────────────────────┘
//    Con sidebar completo y cabecera. Pendiente: añadir AuthGuard.
//
// Ambos grupos usan path:'' como padre — Angular los evalúa en orden
// y cada URL la resuelve el primer grupo cuyas rutas hijas coincidan.
// =============================================================================

import { Routes } from '@angular/router';

import { PublicLayoutComponent }  from './core/layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './core/layouts/private-layout/private-layout.component';

import { HomeComponent }     from './features/home/home.component';
import { LoginComponent }    from './features/auth/login/login.component';
import { RegistroComponent } from './features/auth/registro/registro.component';
import { GruposComponent }   from './features/grupos/grupos.component';
import { VideosComponent }   from './features/videos/videos.component';

export const routes: Routes = [

  // ── ZONA PÚBLICA ─────────────────────────────────────────────────────────
  // Renderizan dentro de PublicLayoutComponent (nav bar simple, sin sidebar).
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

  // ── ZONA PRIVADA ─────────────────────────────────────────────────────────
  // Renderizan dentro de PrivateLayoutComponent (sidebar + cabecera fija).
  // Pendiente: proteger con AuthGuard cuando el servicio de auth esté listo.
  {
    path: '',
    component: PrivateLayoutComponent,
    children: [
      { path: 'videos', component: VideosComponent },
      { path: 'grupos', component: GruposComponent },
    ],
  },

];
