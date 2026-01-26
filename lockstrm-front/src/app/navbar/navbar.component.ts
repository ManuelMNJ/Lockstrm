// Archivo: navbar.component.ts
// Componente que muestra el menu superior de la aplicacion.
// Muestra enlaces y el estado del usuario (logueado o no).
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

  // Variable que guarda la informacion del usuario si esta logueado.
  usuarioLogueado: any = null;

  constructor(private router: Router) {}

  // Al iniciar el componente, comprobamos si hay usuario guardado en el navegador.
  ngOnInit() {
    // Al cargar el menu, miramos si hay alguien guardado en la "caja fuerte" del navegador
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (usuarioGuardado) {
      // Si hay datos, los convertimos de texto a objeto y los asignamos.
      this.usuarioLogueado = JSON.parse(usuarioGuardado);
    }
  }

  // Metodo para cerrar sesion: borra los datos y manda al login.
  cerrarSesion() {
    localStorage.removeItem('usuarioLogueado'); // Borramos datos
    this.usuarioLogueado = null;
    this.router.navigate(['/login']); // Le mandamos al login
  }
}
