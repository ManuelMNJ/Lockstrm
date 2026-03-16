import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {

  usuario = { username: '', email: '', password: '' };
  mensaje = '';

  constructor(private http: HttpClient, private router: Router) {}

  registrar(): void {
    this.http.post('http://localhost:8080/api/auth/registro', this.usuario).subscribe({
      next: () => {
        this.mensaje = 'Cuenta creada. Ahora inicia sesion.';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        console.error('[RegistroComponent] Error al registrar:', err);
        this.mensaje = 'Error al registrar. Intenta de nuevo.';
      }
    });
  }
}
