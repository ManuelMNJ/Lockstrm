import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GrupoService, Grupo } from '../../core/services/grupo.service';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grupos.component.html',
  styleUrl: './grupos.component.css',
})
export class GruposComponent implements OnInit {

  grupos: Grupo[] = [];
  cargando = true;
  errorCarga = '';

  modalAbierto = false;
  nombreNuevoGrupo = '';
  estadoCreacion: 'idle' | 'loading' | 'error' = 'idle';
  errorCreacion = '';

  private destroyRef = inject(DestroyRef);

  constructor(private grupoService: GrupoService) {}

  ngOnInit(): void {
    this.cargarGrupos();
  }

  cargarGrupos(): void {
    this.cargando   = true;
    this.errorCarga = '';
    this.grupoService.obtenerMisGrupos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  (g) => { this.grupos = g; this.cargando = false; },
        error: ()  => { this.errorCarga = 'No se pudo cargar la lista de grupos.'; this.cargando = false; },
      });
  }

  abrirModal(): void {
    this.modalAbierto      = true;
    this.nombreNuevoGrupo  = '';
    this.estadoCreacion    = 'idle';
    this.errorCreacion     = '';
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  crearGrupo(): void {
    const nombre = this.nombreNuevoGrupo.trim();
    if (!nombre) return;

    this.estadoCreacion = 'loading';
    this.errorCreacion  = '';

    this.grupoService.crearGrupo(nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupo) => {
          this.grupos = [...this.grupos, grupo];
          this.cerrarModal();
        },
        error: (err) => {
          this.estadoCreacion = 'error';
          this.errorCreacion  = err?.error?.error || 'Error al crear el grupo.';
        },
      });
  }

  inicialGrupo(nombre: string): string {
    return nombre?.charAt(0)?.toUpperCase() ?? '?';
  }

  formatearFecha(fecha: string | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
