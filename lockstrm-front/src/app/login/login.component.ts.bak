import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {Router} from '@angular/router';

@Component({
  selector: 'app-login', // <--- Esta es la etiqueta que usaremos luego
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html', // <--- Apunta a SU propio HTML
  styleUrl: './login.component.css'
})
export class LoginComponent {

  loginObj = {
    email: '',
    password: ''
  };

  mensaje: string = '';

  constructor(private http: HttpClient,private router: Router) { }

  hacerLogin() {
    const url = 'http://localhost:8080/api/auth/login';

    this.http.post(url, this.loginObj).subscribe({
      next: (res: any) => {
        console.log('Respuesta:', res);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        console.error('Error:', err);
        this.mensaje = '❌ Error: Datos incorrectos';
      }
    });
  }
}
