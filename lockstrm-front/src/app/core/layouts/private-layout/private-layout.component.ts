import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
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
  pageTitle = 'Dashboard';
  mostrarBotonSubir = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.usuarioLogueado = this.authService.getUser();
    this.actualizarHeader(this.router.url);

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.actualizarHeader(e.urlAfterRedirects));
  }

  private actualizarHeader(url: string): void {
    if (url.startsWith('/dashboard')) {
      this.pageTitle          = 'Dashboard';
      this.mostrarBotonSubir  = false;
    } else if (url.startsWith('/videos')) {
      this.pageTitle          = 'Mis Vídeos';
      this.mostrarBotonSubir  = false;
    } else if (url.startsWith('/grupos')) {
      this.pageTitle          = 'Mis Grupos';
      this.mostrarBotonSubir  = false;
    } else if (url.startsWith('/ajustes')) {
      this.pageTitle          = 'Ajustes';
      this.mostrarBotonSubir  = false;
    } else {
      this.pageTitle          = 'Lockstrm';
      this.mostrarBotonSubir  = false;
    }
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
