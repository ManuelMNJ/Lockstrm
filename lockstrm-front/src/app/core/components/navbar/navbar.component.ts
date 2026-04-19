import { Component, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { AuthService, AuthResponse } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {

  usuarioLogueado: AuthResponse | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.usuarioLogueado = this.authService.getUser();
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
