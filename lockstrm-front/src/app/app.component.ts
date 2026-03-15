// =============================================================================
// Lockstrm — AppComponent (raíz)
// Componente mínimo: registra únicamente el <router-outlet> raíz.
// Toda la lógica de sesión y la estructura visual han sido movidas a:
//   src/app/layouts/private-layout/private-layout.component.ts
// =============================================================================
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'lockstrm-front';
}
