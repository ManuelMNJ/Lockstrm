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

  constructor() {
    // Restaura el tema guardado antes de que Angular pinte el primer frame,
    // evitando el flash de modo oscuro al recargar con F5 en modo claro.
    if (localStorage.getItem('lockstrm-theme') === 'light') {
      document.body.classList.add('light-mode');
    }
  }
}
