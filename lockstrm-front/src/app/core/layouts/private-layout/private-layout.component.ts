// =============================================================================
// Lockstrm — PrivateLayoutComponent
// Ruta: src/app/core/layouts/private-layout/
// Shell de la zona autenticada: sidebar + cabecera fija + <router-outlet>.
// Contiene toda la lógica de presentación de sesión (usuario en sidebar,
// cerrar sesión) que antes vivía en AppComponent.
// Las rutas hijas (/videos, /grupos, /ajustes…) se renderizan dentro del
// <router-outlet> que este layout expone.
// =============================================================================
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
  ],
  templateUrl: './private-layout.component.html',
  styleUrl:    './private-layout.component.css',
})
export class PrivateLayoutComponent implements OnInit {

  /** Usuario logueado leído de localStorage — solo para presentación en sidebar. */
  usuarioLogueado: any = null;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('usuarioLogueado');
    if (saved) {
      try {
        this.usuarioLogueado = JSON.parse(saved);
      } catch {
        localStorage.removeItem('usuarioLogueado');
      }
    }
  }

  /** Limpia la sesión y redirige al login. */
  cerrarSesion(): void {
    localStorage.removeItem('usuarioLogueado');
    this.usuarioLogueado = null;
    this.router.navigate(['/login']);
  }

  /** Navega a la sección de vídeos (acción del botón "Subir vídeo" del header). */
  irAVideos(): void {
    this.router.navigate(['/videos']);
  }
}
