// Archivo: app.component.ts
// Componente raiz de la aplicacion. Contiene la estructura principal
// y carga el navbar y la vista segun la ruta.
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// Importamos el componente Login que esta en la carpeta login
import { LoginComponent } from './login/login.component';
import {NavbarComponent} from './navbar/navbar.component';

// Decorador del componente raiz.
@Component({
  selector: 'app-root',
  standalone: true,
  // Se declaran los elementos que usa este componente.
  imports: [RouterOutlet, LoginComponent, NavbarComponent], // <--- Lo añadimos aqui para poder usarlo
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  // Titulo de la aplicacion (usado en la plantilla).
  title = 'lockstrm-front';
}
