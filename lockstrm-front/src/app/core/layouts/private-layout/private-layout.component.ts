import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AuthResponse } from '../../services/auth.service';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './private-layout.component.html',
  styleUrl:    './private-layout.component.css',
})
export class PrivateLayoutComponent implements OnInit {

  usuarioLogueado: AuthResponse | null = null;

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.usuarioLogueado = this.authService.getUser();
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
