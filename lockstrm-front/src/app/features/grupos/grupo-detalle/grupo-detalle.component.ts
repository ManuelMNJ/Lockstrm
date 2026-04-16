import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { GrupoService, Grupo, Miembro } from '../../../core/services/grupo.service';
import { AuthService } from '../../../core/services/auth.service';
import { Video } from '../../../core/services/video.service';
import { InitialPipe } from '../../../shared/pipes/initial.pipe';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, InitialPipe],
  templateUrl: './grupo-detalle.component.html',
  styleUrl: './grupo-detalle.component.css',
})
export class GrupoDetalleComponent implements OnInit {

  grupo: Grupo | null = null;
  miembros: Miembro[] = [];
  videosGrupo: Video[] = [];

  cargando = true;
  errorCarga = '';
  errorDatos: string | null = null;

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

  get esCreador(): boolean {
    const userId = this.authService.currentUser()?.id;
    return !!userId && this.grupo?.idCreador === userId;
  }

  private idGrupo!: number;
  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private grupoService: GrupoService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.idGrupo = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarDatos();
  }

  private cargarDatos(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.idGrupo    = id;
    this.cargando   = true;
    this.errorCarga = '';
    this.errorDatos = null;

    forkJoin({
      grupo: this.grupoService.obtenerGrupoPorId(id).pipe(
        catchError(err => {
          this.errorDatos = err?.error?.error || err?.message || 'No se pudo cargar el grupo';
          return of(null as unknown as Grupo);
        }),
      ),
      miembros:    this.grupoService.obtenerMiembros(id).pipe(catchError(() => of([] as Miembro[]))),
      videosGrupo: this.grupoService.obtenerVideosDeGrupo(id).pipe(catchError(() => of([] as Video[]))),
    })
      .pipe(
        finalize(() => { this.cargando = false; }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ grupo, miembros, videosGrupo }) => {
          this.grupo         = grupo;
          this.nombreEditado = grupo?.nombre ?? '';
          this.miembros      = miembros;
          this.videosGrupo   = videosGrupo;
        },
        error: (err) => {
          this.errorCarga = 'No se pudo cargar la información del grupo.';
          this.errorDatos = err?.message || 'Error desconocido';
        },
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
          this.grupoService.obtenerMiembros(this.idGrupo)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (m) => { this.miembros = m; } });
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

}
