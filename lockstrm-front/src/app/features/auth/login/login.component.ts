import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  loginObj = { email: '', password: '' };
  mensaje  = '';

  constructor(private authService: AuthService, private router: Router) {}

  hacerLogin(): void {
    this.authService.login(this.loginObj.email, this.loginObj.password).subscribe({
      next:  () => this.router.navigate(['/videos']),
      error: (err) => {
        console.error('[LoginComponent] Error de autenticacion:', err);
        this.mensaje = 'Credenciales incorrectas.';
      }
    });
  }
}
