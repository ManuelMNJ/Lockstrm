import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GrupoService, Grupo, Miembro } from '../../../core/services/grupo.service';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grupo-detalle.component.html',
  styleUrl: './grupo-detalle.component.css',
})
export class GrupoDetalleComponent implements OnInit {

  grupo: Grupo | null = null;
  miembros: Miembro[] = [];

  cargando = true;
  errorCarga = '';

  // Añadir miembro
  emailNuevoMiembro = '';
  estadoAnadir: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadir = '';

  // Editar nombre
  editandoNombre = false;
  nombreEditado = '';
  estadoRenombrar: 'idle' | 'loading' | 'error' = 'idle';
  errorRenombrar = '';

  // Eliminar miembro
  eliminandoMiembros = new Set<number>();
  errorEliminarMiembro = '';

  // Eliminar grupo
  confirmandoEliminarGrupo = false;
  estadoEliminarGrupo: 'idle' | 'loading' | 'error' = 'idle';
  errorEliminarGrupo = '';

  private idGrupo!: number;
  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private grupoService: GrupoService,
  ) {}

  ngOnInit(): void {
    this.idGrupo = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando   = true;
    this.errorCarga = '';

    // Cargamos el grupo desde la lista de mis grupos (no hay endpoint GET /grupos/:id)
    this.grupoService.obtenerMisGrupos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupos) => {
          this.grupo = grupos.find(g => g.idGrupo === this.idGrupo) ?? null;
          if (!this.grupo) {
            this.errorCarga = 'Grupo no encontrado.';
            this.cargando = false;
            return;
          }
          this.nombreEditado = this.grupo.nombre;
          this.cargarMiembros();
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar el grupo.';
          this.cargando = false;
        },
      });
  }

  private cargarMiembros(): void {
    this.grupoService.obtenerMiembros(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (m) => { this.miembros = m; this.cargando = false; },
        error: ()  => { this.errorCarga = 'No se pudieron cargar los miembros.'; this.cargando = false; },
      });
  }

  // ── Añadir miembro ────────────────────────────────────────────────────────

  aniadirMiembro(): void {
    const email = this.emailNuevoMiembro.trim();
    if (!email) return;

    this.estadoAnadir = 'loading';
    this.errorAnadir  = '';

    this.grupoService.aniadirMiembro(this.idGrupo, email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.emailNuevoMiembro = '';
          this.estadoAnadir = 'success';
          this.cargarMiembros();
          setTimeout(() => { this.estadoAnadir = 'idle'; }, 3000);
        },
        error: (err) => {
          this.estadoAnadir = 'error';
          this.errorAnadir  = err?.error?.error || err?.error?.mensaje || 'No se pudo añadir el miembro.';
        },
      });
  }

  // ── Eliminar miembro ──────────────────────────────────────────────────────

  eliminarMiembro(miembro: Miembro): void {
    this.eliminandoMiembros = new Set(this.eliminandoMiembros).add(miembro.idUsuario);
    this.errorEliminarMiembro = '';

    this.grupoService.eliminarMiembro(this.idGrupo, miembro.idUsuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.miembros = this.miembros.filter(m => m.idUsuario !== miembro.idUsuario);
          this.eliminandoMiembros = new Set(this.eliminandoMiembros);
          this.eliminandoMiembros.delete(miembro.idUsuario);
        },
        error: (err) => {
          this.eliminandoMiembros = new Set(this.eliminandoMiembros);
          this.eliminandoMiembros.delete(miembro.idUsuario);
          this.errorEliminarMiembro = err?.error?.error || 'No se pudo eliminar el miembro.';
        },
      });
  }

  // ── Renombrar grupo ───────────────────────────────────────────────────────

  activarEdicion(): void {
    this.editandoNombre  = true;
    this.estadoRenombrar = 'idle';
    this.errorRenombrar  = '';
    this.nombreEditado   = this.grupo?.nombre ?? '';
  }

  cancelarEdicion(): void {
    this.editandoNombre = false;
  }

  guardarNombre(): void {
    const nombre = this.nombreEditado.trim();
    if (!nombre || nombre === this.grupo?.nombre) { this.editandoNombre = false; return; }

    this.estadoRenombrar = 'loading';
    this.errorRenombrar  = '';

    this.grupoService.renombrarGrupo(this.idGrupo, nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grupo = g;
          this.editandoNombre  = false;
          this.estadoRenombrar = 'idle';
        },
        error: (err) => {
          this.estadoRenombrar = 'error';
          this.errorRenombrar  = err?.error?.error || 'No se pudo actualizar el nombre.';
        },
      });
  }

  // ── Eliminar grupo ────────────────────────────────────────────────────────

  solicitarEliminarGrupo(): void {
    this.confirmandoEliminarGrupo = true;
    this.estadoEliminarGrupo      = 'idle';
    this.errorEliminarGrupo       = '';
  }

  cancelarEliminarGrupo(): void {
    this.confirmandoEliminarGrupo = false;
  }

  confirmarEliminarGrupo(): void {
    this.estadoEliminarGrupo = 'loading';

    this.grupoService.eliminarGrupo(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/mi-espacio/grupos']),
        error: (err) => {
          this.estadoEliminarGrupo = 'error';
          this.errorEliminarGrupo  = err?.error?.error || 'No se pudo eliminar el grupo.';
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  volver(): void {
    this.router.navigate(['/mi-espacio/grupos']);
  }

  inicialGrupo(nombre: string): string {
    return nombre?.charAt(0)?.toUpperCase() ?? '?';
  }
}
