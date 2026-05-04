import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { STORAGE_KEYS as KEYS } from '../../core/constants/storage-keys';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {

  private readonly auth       = inject(AuthService);
  private readonly userSvc    = inject(UserService);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ── Apariencia ────────────────────────────────────────────────────
  modoOscuro = localStorage.getItem(KEYS.theme) !== 'light';

  toggleModo(): void {
    this.modoOscuro = !this.modoOscuro;
    document.body.classList.toggle('light-mode', !this.modoOscuro);
    localStorage.setItem(KEYS.theme, this.modoOscuro ? 'dark' : 'light');
  }

  // ── Reproductor ───────────────────────────────────────────────────
  readonly velocidades = ['0.5', '0.75', '1', '1.25', '1.5', '2'];

  autoplay      = localStorage.getItem(KEYS.autoplay)     !== 'false';
  velocidad     = localStorage.getItem(KEYS.speed)        ?? '1';
  volumeMemory  = localStorage.getItem(KEYS.volumeMemory) !== 'false';

  toggleAutoplay(): void {
    this.autoplay = !this.autoplay;
    localStorage.setItem(KEYS.autoplay, String(this.autoplay));
  }

  setVelocidad(v: string): void {
    this.velocidad = v;
    localStorage.setItem(KEYS.speed, v);
  }

  toggleVolumeMemory(): void {
    this.volumeMemory = !this.volumeMemory;
    localStorage.setItem(KEYS.volumeMemory, String(this.volumeMemory));
  }

  // ── Sesión ────────────────────────────────────────────────────────
  get usuario() { return this.auth.getUser(); }

  cerrarSesion(): void {
    this.auth.logout();
  }

  // ── Zona de peligro — eliminar cuenta ─────────────────────────────
  modalEliminar    = false;
  confirmacionText = '';
  estadoEliminar: 'idle' | 'loading' | 'error' = 'idle';
  errorEliminar    = '';

  abrirModalEliminar(): void {
    this.modalEliminar    = true;
    this.confirmacionText = '';
    this.estadoEliminar   = 'idle';
    this.errorEliminar    = '';
    this.cdr.markForCheck();
  }

  cerrarModalEliminar(): void {
    this.modalEliminar = false;
    this.cdr.markForCheck();
  }

  get puedeConfirmarEliminar(): boolean {
    return this.confirmacionText.trim().toUpperCase() === 'ELIMINAR';
  }

  confirmarEliminarCuenta(): void {
    if (!this.puedeConfirmarEliminar) return;
    this.estadoEliminar = 'loading';
    this.cdr.markForCheck();

    this.userSvc.eliminarCuenta().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.auth.logout(['/login'], { cuentaEliminada: '1' }),
      error: (err) => {
        this.estadoEliminar = 'error';
        this.errorEliminar  = err?.error?.message || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }
}
