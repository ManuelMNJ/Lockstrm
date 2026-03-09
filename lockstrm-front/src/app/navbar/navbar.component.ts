import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {

  usuarioLogueado: any = null;

  constructor(private router: Router) {}

  ngOnInit() {
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (usuarioGuardado) {
      this.usuarioLogueado = JSON.parse(usuarioGuardado);
    }
  }

  cerrarSesion() {
    localStorage.removeItem('usuarioLogueado');
    this.usuarioLogueado = null;
    this.router.navigate(['/login']);
  }
}
