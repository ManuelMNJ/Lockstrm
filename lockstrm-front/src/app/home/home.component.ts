// Archivo: home.component.ts
// Componente de la pagina principal (home). Muestra la bienvenida
// y enlaces para navegar. No necesita logica compleja por ahora.
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router'; // Para que funcione el boton de "Unete ahora"

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink], // Importamos RouterLink
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  // Por ahora la Home es publica, no necesita logica especial
}
