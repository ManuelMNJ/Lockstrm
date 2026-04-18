import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { GrupoService, Grupo, Miembro } from '../../../core/services/grupo.service';
import { VideoService, Video, VideoVistaEstadistica } from '../../../core/services/video.service';
import { InitialPipe } from '../../../shared/pipes/initial.pipe';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';
import { VideoPlayerComponent } from '../../videos/video-player/video-player.component';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, InitialPipe, VideoDurationPipe, VideoPlayerComponent],
  templateUrl: './grupo-detalle.component.html',
  styleUrl: './grupo-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrupoDetalleComponent implements OnInit {

  grupo: Grupo | null = null;
  esCreador = false;
  miembros: Miembro[] = [];

  // Vídeos del grupo
  videosGrupo: Video[] = [];
  misVideosDisponibles: Video[] = [];
  idVideoAAnadir: number | null = null;
  estadoAnadirVideo: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadirVideo = '';
  quitandoVideos = new Set<number>();
  videoReproduciendose: Video | null = null;

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

  // Estadísticas de vistas
  videoStats: Video | null = null;
  estadisticas: VideoVistaEstadistica[] = [];
  cargandoStats = false;
  errorStats = '';

  private idGrupo!: number;
  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private grupoService: GrupoService,
    protected videoService: VideoService,
    private cdr: ChangeDetectorRef,
  ) {}

  private extractErrorMessage(err: any, defaultMsg: string): string {
    return err?.error?.error || err?.error?.mensaje || defaultMsg;
  }

  private addEliminando(idUsuario: number): void {
    this.eliminandoMiembros = new Set(this.eliminandoMiembros).add(idUsuario);
  }

  private removeEliminando(idUsuario: number): void {
    const next = new Set(this.eliminandoMiembros);
    next.delete(idUsuario);
    this.eliminandoMiembros = next;
  }

  ngOnInit(): void {
    this.idGrupo = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando   = true;
    this.errorCarga = '';

    forkJoin({
      grupo:   this.grupoService.obtenerGrupoPorId(this.idGrupo),
      creados: this.grupoService.obtenerGruposCreados(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { this.cargando = false; this.cdr.markForCheck(); }),
      )
      .subscribe({
        next: ({ grupo, creados }) => {
          this.grupo         = grupo;
          this.nombreEditado = grupo.nombre;
          this.esCreador     = creados.some(g => g.idGrupo === this.idGrupo);
          this.cdr.markForCheck();
          this.cargarMiembros();
          this.cargarVideos();
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar la información del grupo.';
        },
      });
  }

  private cargarMiembros(): void {
    this.grupoService.obtenerMiembros(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (miembros) => { this.miembros = miembros; this.cdr.markForCheck(); },
        error: () => {},
      });
  }

  private cargarVideos(): void {
    const videos$ = this.esCreador
      ? this.videoService.obtenerMisVideos()
      : this.videoService.obtenerVideosCompartidos();

    videos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          this.videosGrupo          = videos.filter(v => v.grupo?.idGrupo === this.idGrupo);
          this.misVideosDisponibles = this.esCreador
            ? videos.filter(v => !v.grupo || v.grupo.idGrupo !== this.idGrupo)
            : [];
          this.cdr.markForCheck();
        },
        error: () => {},
      });
  }

  // ── Añadir vídeo existente ────────────────────────────────────────────────

  aniadirVideoExistente(): void {
    if (this.idVideoAAnadir == null) return;
    const video = this.misVideosDisponibles.find(v => v.idVideo === this.idVideoAAnadir);
    if (!video) return;

    this.estadoAnadirVideo = 'loading';
    this.errorAnadirVideo  = '';
    this.cdr.markForCheck();

    this.videoService.editarVideo(video.idVideo, video.titulo, this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.idVideoAAnadir    = null;
          this.estadoAnadirVideo = 'success';
          this.cdr.markForCheck();
          this.cargarVideos();
          setTimeout(() => { this.estadoAnadirVideo = 'idle'; this.cdr.markForCheck(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadirVideo = 'error';
          this.errorAnadirVideo  = this.extractErrorMessage(err, 'No se pudo añadir el vídeo.');
          this.cdr.markForCheck();
        },
      });
  }

  // ── Quitar vídeo del grupo ────────────────────────────────────────────────

  quitarVideoDelGrupo(video: Video): void {
    this.quitandoVideos = new Set(this.quitandoVideos).add(video.idVideo);

    this.videoService.editarVideo(video.idVideo, video.titulo, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          this.videosGrupo          = this.videosGrupo.filter(v => v.idVideo !== video.idVideo);
          this.misVideosDisponibles = [...this.misVideosDisponibles, { ...video, grupo: undefined }];
          this.cdr.markForCheck();
        },
        error: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Añadir miembro ────────────────────────────────────────────────────────

  aniadirMiembro(): void {
    const email = this.emailNuevoMiembro.trim();
    if (!email) return;

    this.estadoAnadir = 'loading';
    this.errorAnadir  = '';
    this.cdr.markForCheck();

    this.grupoService.aniadirMiembro(this.idGrupo, email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.emailNuevoMiembro = '';
          this.estadoAnadir = 'success';
          this.cdr.markForCheck();
          this.cargarMiembros();
          setTimeout(() => { this.estadoAnadir = 'idle'; this.cdr.markForCheck(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadir = 'error';
          this.errorAnadir  = this.extractErrorMessage(err, 'No se pudo añadir el miembro.');
          this.cdr.markForCheck();
        },
      });
  }

  // ── Eliminar miembro ──────────────────────────────────────────────────────

  eliminarMiembro(miembro: Miembro): void {
    this.addEliminando(miembro.idUsuario);
    this.errorEliminarMiembro = '';
    this.cdr.markForCheck();

    this.grupoService.eliminarMiembro(this.idGrupo, miembro.idUsuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.miembros = this.miembros.filter(m => m.idUsuario !== miembro.idUsuario);
          this.removeEliminando(miembro.idUsuario);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.removeEliminando(miembro.idUsuario);
          this.errorEliminarMiembro = this.extractErrorMessage(err, 'No se pudo eliminar el miembro.');
          this.cdr.markForCheck();
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
    if (!nombre || nombre === this.grupo?.nombre) {
      this.editandoNombre = false;
      this.cdr.markForCheck();
      return;
    }

    this.estadoRenombrar = 'loading';
    this.errorRenombrar  = '';
    this.cdr.markForCheck();

    this.grupoService.renombrarGrupo(this.idGrupo, nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grupo           = g;
          this.nombreEditado   = g.nombre;
          this.editandoNombre  = false;
          this.estadoRenombrar = 'idle';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.estadoRenombrar = 'error';
          this.errorRenombrar  = this.extractErrorMessage(err, 'No se pudo actualizar el nombre.');
          this.cdr.markForCheck();
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
    this.cdr.markForCheck();

    this.grupoService.eliminarGrupo(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/mi-espacio/grupos']),
        error: (err) => {
          this.estadoEliminarGrupo = 'error';
          this.errorEliminarGrupo  = this.extractErrorMessage(err, 'No se pudo eliminar el grupo.');
          this.cdr.markForCheck();
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.videoReproduciendose) { this.cerrarReproductor(); return; }
    if (this.videoStats)           { this.cerrarStats();       return; }
  }

  abrirStats(video: Video): void {
    this.videoStats      = video;
    this.estadisticas    = [];
    this.cargandoStats   = true;
    this.errorStats      = '';
    this.cdr.markForCheck();

    this.videoService.obtenerEstadisticas(video.idVideo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.estadisticas  = data;
          this.cargandoStats = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorStats    = 'No se pudieron cargar las estadísticas.';
          this.cargandoStats = false;
          this.cdr.markForCheck();
        },
      });
  }

  cerrarStats(): void {
    this.videoStats = null;
    this.cdr.markForCheck();
  }

  verVideo(video: Video): void {
    this.videoReproduciendose = video;
    this.cdr.markForCheck();
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.markForCheck();
  }

  onHeartbeat(currentTime: number): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;
    this.videoService.registrarHeartbeat(idVideo, currentTime)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => {} });
  }

  volver(): void {
    this.router.navigate(['/mi-espacio/grupos']);
  }

}
