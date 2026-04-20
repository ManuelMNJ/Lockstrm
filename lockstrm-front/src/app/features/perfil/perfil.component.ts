import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { UsuarioService, PerfilUsuario } from '../../core/services/usuario.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, DateLocalePipe],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent implements OnInit {

  perfil: PerfilUsuario | null = null;
  cargando = true;
  error = '';

  private usuarioService = inject(UsuarioService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.cargarPerfil();
  }

  private cargarPerfil(): void {
    this.cargando = true;
    
    this.usuarioService.obtenerPerfil()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { 
          this.cargando = false; 
          this.cdr.markForCheck(); // Obligamos a Angular a actualizar la vista
        })
      )
      .subscribe({
        next: (p) => { 
          this.perfil = p; 
          this.cdr.markForCheck(); // Obligamos a Angular a actualizar la vista
        },
        error: () => { 
          this.error = 'No se pudo cargar la información de perfil.'; 
          this.cdr.markForCheck(); // Obligamos a Angular a actualizar la vista
        },
      });
  }

  rolLegible(rol: string | undefined | null): string {
    switch (rol) {
      case 'SUPER_ADMIN': return 'Administrador';
      case 'ADMIN':       return 'Admin';
      case 'USER':        return 'Usuario';
      default:            return rol || '—';
    }
  }
}