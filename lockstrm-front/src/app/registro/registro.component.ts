import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {Router} from '@angular/router';


@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {

  usuario = {
    username: '',
    email: '',
    password: ''
  };

  mensaje: string = '';

  constructor(private http: HttpClient, private router: Router) { }

  registrar() {
    const url = 'http://localhost:8080/api/auth/registro';

    this.http.post(url, this.usuario).subscribe({
      next: (respuesta: any) => {
        alert('¡Cuenta creada! Ahora inicia sesión ');
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Error:', error);
        this.mensaje = ' Error al registrar (Revisa la consola)';
      }
    });
  }
}
