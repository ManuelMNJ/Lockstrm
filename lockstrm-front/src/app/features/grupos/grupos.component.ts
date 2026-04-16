import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { GrupoService, Grupo, GrupoStats } from '../../core/services/grupo.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';
import { InitialPipe } from '../../shared/pipes/initial.pipe';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, DateLocalePipe, InitialPipe],
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

  statsMap = new Map<number, GrupoStats>();

  @ViewChild('nombreGrupoInput') nombreGrupoInput?: ElementRef<HTMLInputElement>;

  private destroyRef = inject(DestroyRef);

  constructor(
    private grupoService: GrupoService,
    private router: Router,
  ) {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.modalAbierto) this.cerrarModal();
  }

  ngOnInit(): void {
    this.cargarGrupos();
  }

  abrirDetalle(grupo: Grupo): void {
    this.router.navigate(['/mi-espacio/grupos', grupo.idGrupo]);
  }

  cargarGrupos(): void {
    this.cargando   = true;
    this.errorCarga = '';
    this.grupoService.obtenerMisGrupos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grupos   = g;
          this.cargando = false;
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar la lista de grupos.';
          this.cargando   = false;
        },
      });

    this.grupoService.obtenerGrupoStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          const map = new Map<number, GrupoStats>();
          stats.forEach(s => map.set(s.idGrupo, s));
          this.statsMap = map;
        },
        error: () => { /* stats opcionales */ },
      });
  }

  abrirModal(): void {
    this.modalAbierto     = true;
    this.nombreNuevoGrupo = '';
    this.estadoCreacion   = 'idle';
    this.errorCreacion    = '';
    setTimeout(() => this.nombreGrupoInput?.nativeElement.focus(), 50);
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
          const newStats: GrupoStats = {
            idGrupo: grupo.idGrupo,
            nombre: grupo.nombre,
            idCreador: grupo.idCreador!,
            totalMiembros: 0,
          };
          this.statsMap = new Map(this.statsMap).set(grupo.idGrupo, newStats);
          this.cerrarModal();
        },
        error: (err) => {
          this.estadoCreacion = 'error';
          this.errorCreacion  = err?.error?.error || 'Error al crear el grupo.';
        },
      });
  }
}
