// =============================================================================
// Lockstrm — PublicLayoutComponent
// Ruta: src/app/core/layouts/public-layout/
// Contenedor de todas las rutas públicas (/, /home, /login, /registro).
// No incluye sidebar. Expone una barra de navegación mínima con logo y
// accesos directos a Login / Registro, y un <router-outlet>.
// =============================================================================
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './public-layout.component.html',
  styleUrl:    './public-layout.component.css',
})
export class PublicLayoutComponent {}
