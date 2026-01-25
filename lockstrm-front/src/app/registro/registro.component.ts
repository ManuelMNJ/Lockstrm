import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Para leer los inputs
import { HttpClient } from '@angular/common/http';
import {Router} from '@angular/router'; // Para hablar con Java

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule], // Importamos herramientas básicas
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {
  // Estos son los datos que rellenará el usuario
  usuario = {
    username: '',
    email: '',
    password: ''
  };

  mensaje: string = '';

  constructor(private http: HttpClient, private router: Router) { }

  registrar() {
    // URL de tu Backend Java
    const url = 'http://localhost:8080/api/auth/registro';

    // Enviamos los datos (POST)
    this.http.post(url, this.usuario).subscribe({
      next: (respuesta: any) => {
        alert('¡Cuenta creada! Ahora inicia sesión 🚀'); // Opcional: un aviso visual
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Error:', error);
        this.mensaje = '❌ Error al registrar (Revisa la consola)';
      }
    });
  }
}
