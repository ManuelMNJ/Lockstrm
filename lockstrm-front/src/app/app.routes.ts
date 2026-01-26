// Archivo: app.routes.ts
// Definicion de las rutas de la aplicacion.
// Cada objeto indica una URL y el componente que muestra esa pagina.

import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { HomeComponent } from './home/home.component';
import { GruposComponent } from './grupos/grupos.component';
import { VideosComponent } from './videos/videos.component';

export const routes: Routes = [
  // 1. CAMBIO CLAVE: Si la ruta esta vacia, vamos a HOME (no a login)
  { path: '', component: HomeComponent },

  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },

  // Estas paginas seran privadas (luego las protegeremos mejor)
  { path: 'grupos', component: GruposComponent },
  { path: 'videos', component: VideosComponent }
];
