import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService, PerfilUsuario } from '../../core/services/usuario.service';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css',
})
export class AjustesComponent implements OnInit {

  perfil: PerfilUsuario | null = null;
  cargandoPerfil = true;

  // Cambiar contraseña
  contrasenaActual = '';
  contrasenaNueva  = '';
  contrasenaConfirm = '';
  estadoPassword: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePassword = '';

  // Dark mode
  modoOscuro = true;

  private destroyRef = inject(DestroyRef);

  constructor(private usuarioService: UsuarioService) {}

  ngOnInit(): void {
    this.modoOscuro = document.body.classList.contains('light-mode') === false;

    this.usuarioService.obtenerPerfil()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  (p) => { this.perfil = p; this.cargandoPerfil = false; },
        error: ()  => { this.cargandoPerfil = false; },
      });
  }

  cambiarContrasena(): void {
    if (!this.contrasenaActual || !this.contrasenaNueva) return;
    if (this.contrasenaNueva !== this.contrasenaConfirm) {
      this.estadoPassword  = 'error';
      this.mensajePassword = 'Las contraseñas nuevas no coinciden.';
      return;
    }
    if (this.contrasenaNueva.length < 8) {
      this.estadoPassword  = 'error';
      this.mensajePassword = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    this.estadoPassword  = 'loading';
    this.mensajePassword = '';

    this.usuarioService.cambiarContrasena(this.contrasenaActual, this.contrasenaNueva)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.estadoPassword   = 'success';
          this.mensajePassword  = res.mensaje ?? 'Contraseña actualizada correctamente.';
          this.contrasenaActual  = '';
          this.contrasenaNueva   = '';
          this.contrasenaConfirm = '';
          setTimeout(() => { this.estadoPassword = 'idle'; }, 4000);
        },
        error: (err) => {
          this.estadoPassword  = 'error';
          this.mensajePassword = err?.error?.error || 'No se pudo actualizar la contraseña.';
        },
      });
  }

  toggleModo(): void {
    this.modoOscuro = !this.modoOscuro;
    document.body.classList.toggle('light-mode', !this.modoOscuro);
    localStorage.setItem('lockstrm-theme', this.modoOscuro ? 'dark' : 'light');
  }

  formatearFecha(fecha: string | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  rolLegible(rol: string | undefined): string {
    if (!rol) return '—';
    return rol === 'SUPER_ADMIN' ? 'Administrador' : 'Miembro';
  }
}
