// Archivo: registro.component.ts
// Componente para registrar un usuario nuevo desde la interfaz.
// Aqui se recogen los datos del formulario y se envian al backend.
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Para leer los inputs
import { HttpClient } from '@angular/common/http';
import {Router} from '@angular/router'; // Para hablar con Java

// Decorador que marca la clase como componente Angular.
@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule], // Importamos herramientas basicas
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {
  // Datos que rellenara el usuario en el formulario.
  usuario = {
    username: '',
    email: '',
    password: ''
  };

  // Mensaje para mostrar errores u otra informacion en la vista.
  mensaje: string = '';

  // Inyectamos HttpClient para llamar al backend y Router para navegar.
  constructor(private http: HttpClient, private router: Router) { }

  // Metodo que se ejecuta al enviar el formulario de registro.
  registrar() {
    // URL del backend Java donde esta el endpoint de registro.
    const url = 'http://localhost:8080/api/auth/registro';

    // Enviamos los datos con una peticion POST.
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
