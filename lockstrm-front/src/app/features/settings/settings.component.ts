import { Component, ElementRef, ViewChild, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { STORAGE_KEYS as KEYS } from '../../core/constants/storage-keys';
import { UI_TIMINGS } from '../../shared/utils/ui-constants';

/** Lee localStorage sin lanzar en modo privado / quota exceeded. */
function lsGet(key: string, fallback: string | null = null): string | null {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
/** Escribe localStorage sin lanzar; la preferencia simplemente no persiste. */
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* sin-persistencia silenciosa */ }
}

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

  modoOscuro = lsGet(KEYS.theme) !== 'light';

  toggleModo(): void {
    this.modoOscuro = !this.modoOscuro;
    document.body.classList.toggle('light-mode', !this.modoOscuro);
    lsSet(KEYS.theme, this.modoOscuro ? 'dark' : 'light');
  }

  readonly velocidades = ['0.5', '0.75', '1', '1.25', '1.5', '2'];

  autoplay      = lsGet(KEYS.autoplay)     !== 'false';
  velocidad     = lsGet(KEYS.speed)        ?? '1';
  volumeMemory  = lsGet(KEYS.volumeMemory) !== 'false';

  toggleAutoplay(): void {
    this.autoplay = !this.autoplay;
    lsSet(KEYS.autoplay, String(this.autoplay));
  }

  setVelocidad(v: string): void {
    if (!this.velocidades.includes(v)) return;
    this.velocidad = v;
    lsSet(KEYS.speed, v);
  }

  toggleVolumeMemory(): void {
    this.volumeMemory = !this.volumeMemory;
    lsSet(KEYS.volumeMemory, String(this.volumeMemory));
  }

  get usuario() { return this.auth.getUser(); }

  cerrarSesion(): void {
    this.auth.logout();
  }

  @ViewChild('confirmInput') private confirmInput?: ElementRef<HTMLInputElement>;

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
    setTimeout(() => this.confirmInput?.nativeElement.focus(), UI_TIMINGS.DOM_FOCUS_DELAY_MS);
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
