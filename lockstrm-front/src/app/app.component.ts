import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// Importamos el componente Login que está en la carpeta login
import { LoginComponent } from './login/login.component';
import {NavbarComponent} from './navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoginComponent, NavbarComponent], // <--- Lo añadimos aquí para poder usarlo
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'lockstrm-front';
}
