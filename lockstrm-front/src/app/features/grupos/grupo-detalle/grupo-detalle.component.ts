import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { GrupoService, Grupo, Miembro } from '../../../core/services/grupo.service';
import { VideoService, Video } from '../../../core/services/video.service';
import { InitialPipe } from '../../../shared/pipes/initial.pipe';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, InitialPipe, VideoDurationPipe],
  templateUrl: './grupo-detalle.component.html',
  styleUrl: './grupo-detalle.component.css',
})
export class GrupoDetalleComponent implements OnInit {

  grupo: Grupo | null = null;
  esCreador = false;
  miembros: Miembro[] = [];
  videosGrupo: Video[] = [];

  // Vídeos del grupo
  videosGrupo: Video[] = [];
  misVideosDisponibles: Video[] = [];
  idVideoAAnadir: number | null = null;
  estadoAnadirVideo: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadirVideo = '';
  quitandoVideos = new Set<number>();

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
  estadoEliminarGrupo: 'idle' | 'loading' | 'error' = 'idle';
  errorEliminarGrupo = '';

  // Reproducir vídeo
  videoReproduciendose: Video | null = null;

  // Añadir vídeo existente
  mostrarSelectorVideo = false;
  videosDisponibles: Video[] = [];
  videoSeleccionadoId: number | null = null;
  estadoAniadirVideo: 'idle' | 'loading' | 'error' = 'idle';
  errorAniadirVideo = '';

  get esCreador(): boolean {
    return !!this.grupo?.esCreador;
  }

  private idGrupo!: number;
  private destroyRef = inject(DestroyRef);

  constructor(
    private route:        ActivatedRoute,
    private router:       Router,
    private grupoService: GrupoService,
    private videoService: VideoService,
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
    this.errorDatos = null;

    forkJoin({
      grupo:   this.grupoService.obtenerGrupoPorId(this.idGrupo),
      creados: this.grupoService.obtenerGruposCreados(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { this.cargando = false; this.cdr.detectChanges(); }),
      )
      .subscribe({
        next: ({ grupo, creados }) => {
          this.grupo         = grupo;
          this.nombreEditado = grupo.nombre;
          this.esCreador     = creados.some(g => g.idGrupo === this.idGrupo);
          this.cdr.detectChanges();
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
        next: (miembros) => { this.miembros = miembros; this.cdr.detectChanges(); },
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
          this.cdr.detectChanges();
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
    this.cdr.detectChanges();

    this.videoService.editarVideo(video.idVideo, video.titulo, this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.idVideoAAnadir    = null;
          this.estadoAnadirVideo = 'success';
          this.cdr.detectChanges();
          this.cargarVideos();
          setTimeout(() => { this.estadoAnadirVideo = 'idle'; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadirVideo = 'error';
          this.errorAnadirVideo  = this.extractErrorMessage(err, 'No se pudo añadir el vídeo.');
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
        },
        error: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          this.cdr.detectChanges();
        },
      });
  }

  // ── Añadir miembro ────────────────────────────────────────────────────────

  aniadirMiembro(): void {
    const email = this.emailNuevoMiembro.trim();
    if (!email) return;

    this.estadoAnadir = 'loading';
    this.errorAnadir  = '';
    this.cdr.detectChanges();

    this.grupoService.aniadirMiembro(this.idGrupo, email)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.estadoAnadir = this.estadoAnadir === 'loading' ? 'idle' : this.estadoAnadir;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (miembro) => {
          this.miembros.push(miembro);
          this.emailNuevoMiembro = '';
          this.estadoAnadir = 'success';
          this.cdr.detectChanges();
          this.cargarMiembros();
          setTimeout(() => { this.estadoAnadir = 'idle'; this.cdr.detectChanges(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadir = 'error';
          this.errorAnadir  = this.extractErrorMessage(err, 'No se pudo añadir el miembro.');
          this.cdr.detectChanges();
        },
      });
  }

  // ── Eliminar miembro ──────────────────────────────────────────────────────

  eliminarMiembro(miembro: Miembro): void {
    this.addEliminando(miembro.idUsuario);
    this.errorEliminarMiembro = '';
    this.cdr.detectChanges();

    this.grupoService.eliminarMiembro(this.idGrupo, miembro.idUsuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.miembros = this.miembros.filter(m => m.idUsuario !== miembro.idUsuario);
          this.removeEliminando(miembro.idUsuario);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.removeEliminando(miembro.idUsuario);
          this.errorEliminarMiembro = this.extractErrorMessage(err, 'No se pudo eliminar el miembro.');
          this.cdr.detectChanges();
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
      this.cdr.detectChanges();
      return;
    }

    this.estadoRenombrar = 'loading';
    this.errorRenombrar  = '';
    this.cdr.detectChanges();

    this.grupoService.renombrarGrupo(this.idGrupo, nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grupo           = g;
          this.nombreEditado   = g.nombre;
          this.editandoNombre  = false;
          this.estadoRenombrar = 'idle';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.estadoRenombrar = 'error';
          this.errorRenombrar  = this.extractErrorMessage(err, 'No se pudo actualizar el nombre.');
          this.cdr.detectChanges();
        },
      });
  }

  // ── Eliminar grupo ────────────────────────────────────────────────────────

  async eliminarGrupo(): Promise<void> {
    const ok = await this.modalService.confirm(
      'Eliminar grupo',
      `¿Eliminar "${this.grupo!.nombre}"? Se eliminarán todos los permisos asociados. Los vídeos no se borran, pero dejarán de ser accesibles para los miembros. Esta acción no se puede deshacer.`,
      'Eliminar grupo',
    );
    if (!ok) return;

    this.estadoEliminarGrupo = 'loading';
    this.cdr.detectChanges();

    this.grupoService.eliminarGrupo(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  () => this.router.navigate(['/mi-espacio/grupos']),
        error: (err) => {
          this.estadoEliminarGrupo = 'error';
          this.errorEliminarGrupo  = this.extractErrorMessage(err, 'No se pudo eliminar el grupo.');
          this.cdr.detectChanges();
        },
      });
  }

  // ── Añadir vídeo existente ────────────────────────────────────────────────

  abrirSelectorVideo(): void {
    this.mostrarSelectorVideo = true;
    this.videoSeleccionadoId  = null;
    this.estadoAniadirVideo   = 'idle';
    this.errorAniadirVideo    = '';

    this.videoService.obtenerMisVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          this.videosDisponibles = videos.filter(
            v => v.grupo?.idGrupo == null || v.grupo.idGrupo !== this.idGrupo,
          );
          this.cdr.detectChanges();
        },
      });
  }

  cerrarSelectorVideo(): void {
    this.mostrarSelectorVideo = false;
    this.videoSeleccionadoId  = null;
    this.estadoAniadirVideo   = 'idle';
    this.errorAniadirVideo    = '';
  }

  confirmarAniadirVideo(): void {
    if (!this.videoSeleccionadoId) return;

    const video = this.videosDisponibles.find(v => v.idVideo === this.videoSeleccionadoId);
    if (!video) return;

    this.estadoAniadirVideo = 'loading';
    this.errorAniadirVideo  = '';

    this.videoService.editarVideo(video.idVideo, video.titulo, this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.videosGrupo = [...this.videosGrupo, updated];
          this.cerrarSelectorVideo();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.estadoAniadirVideo = 'error';
          this.errorAniadirVideo  = err?.error?.error || 'No se pudo añadir el vídeo.';
          this.cdr.detectChanges();
        },
      });
  }

  // ── Quitar vídeo del grupo ────────────────────────────────────────────────

  async quitarVideo(video: Video): Promise<void> {
    const ok = await this.modalService.confirm(
      'Quitar vídeo del grupo',
      `El vídeo "${video.titulo}" dejará de estar asociado a este grupo. El vídeo no se eliminará.`,
      'Quitar vídeo',
    );
    if (!ok) return;

    this.videoService.editarVideo(video.idVideo, video.titulo, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.videosGrupo = this.videosGrupo.filter(v => v.idVideo !== video.idVideo);
          this.cdr.detectChanges();
        },
      });
  }

  // ── Reproducir vídeo ─────────────────────────────────────────────────────

  verVideo(idVideo: number): void {
    const video = this.videosGrupo.find(v => v.idVideo === idVideo);
    if (video) {
      this.videoReproduciendose = video;
      this.cdr.detectChanges();
    }
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.detectChanges();
  }

  onHeartbeat(currentTime: number): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;
    this.videoService.registrarHeartbeat(idVideo, currentTime)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (err) => console.warn('[Heartbeat] Error:', err?.status) });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  verVideo(idVideo: number): void {
    this.router.navigate(['/mi-espacio/videos', idVideo]);
  }

  volver(): void {
    this.router.navigate(['/mi-espacio/grupos']);
  }

}
