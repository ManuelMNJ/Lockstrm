import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; // Importamos RouterLink para navegar



@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink], // Importamos herramientas de HTML y Rutas
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {

  usuarioLogueado: any = null;

  constructor(private router: Router) {}

  ngOnInit() {
    // Al cargar el menú, miramos si hay alguien guardado en la "caja fuerte" del navegador
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (usuarioGuardado) {
      this.usuarioLogueado = JSON.parse(usuarioGuardado);
    }
  }

  cerrarSesion() {
    localStorage.removeItem('usuarioLogueado'); // Borramos datos
    this.usuarioLogueado = null;
    this.router.navigate(['/login']); // Le mandamos al login
  }
}
