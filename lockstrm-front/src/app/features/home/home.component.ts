// =============================================================================
// Lockstrm — HomeComponent (Landing Page pública)
// Ruta: src/app/features/home/
// =============================================================================
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  // Por ahora la Home es pública, no necesita lógica especial
}
