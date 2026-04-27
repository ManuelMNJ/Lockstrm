import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, combineLatest } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { VideoService, Video, GrupoRef } from '../../../core/services/video.service';
import { AnaliticasService, VideoLog } from '../../../core/services/analiticas.service';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../../shared/pipes/thumbnail-src.pipe';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-analiticas-video',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, VideoDurationPipe, ThumbnailSrcPipe, CustomSelectComponent],
  templateUrl: './analiticas-video.component.html',
  styleUrl: './analiticas-video.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliticasVideoComponent implements OnInit {

  video:        Video | null = null;
  logs:         VideoLog[]   = [];
  cargando      = true;
  error         = '';
  thumbFailed   = false;

  onThumbError(): void {
    this.thumbFailed = true;
    this.cdr.markForCheck();
  }

  /**
   * Filtro activo de grupo:
   *  - 'all'   → todas las visualizaciones
   *  - 'none'  → solo las reproducciones sin contexto de grupo
   *  - número  → un grupo concreto
   *
   * En modo "from=grupo" el filtro arranca y se queda fijo en el grupo de
   * origen porque el backend solo nos devuelve esas filas. En modo global
   * (propietario), el desplegable se puede cambiar a piacere.
   */
  filtroGrupo: 'all' | 'none' | number = 'all';

  /**
   * Origen de la navegación. "grupo" significa que llegamos desde la pestaña
   * Analíticas del detalle de un grupo y debemos:
   *  - Cargar el vídeo desde `obtenerVideosPorGrupo` (el solicitante puede no
   *    ser propietario; sí miembro del grupo).
   *  - Pedir los logs ya filtrados por ese grupo al backend.
   *  - Volver al detalle del grupo, no al panel global.
   */
  fromGrupo:  boolean = false;
  grupoIdCtx: number | null = null;

  /**
   * Preset de fecha activo. Cambia → refetch al backend (no filtramos en
   * cliente porque queremos que las KPIs sean exactas para el rango y el
   * dataset puede ser grande).
   */
  rangoActivo: '7d' | '30d' | '90d' | 'all' = 'all';

  private idVideo: number | null = null;

  private readonly route             = inject(ActivatedRoute);
  private readonly router            = inject(Router);
  private readonly videoService      = inject(VideoService);
  private readonly analiticasService = inject(AnaliticasService);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly destroyRef        = inject(DestroyRef);

  ngOnInit(): void {
    const idVideo = Number(this.route.snapshot.paramMap.get('idVideo'));
    if (!idVideo) {
      this.error    = 'Vídeo no válido.';
      this.cargando = false;
      return;
    }
    this.idVideo = idVideo;

    const qp = this.route.snapshot.queryParamMap;
    this.fromGrupo  = qp.get('from') === 'grupo';
    const grupoStr  = qp.get('grupoId');
    this.grupoIdCtx = grupoStr != null ? Number(grupoStr) : null;

    if (this.fromGrupo && this.grupoIdCtx != null) {
      this.filtroGrupo = this.grupoIdCtx;
    }

    // Heredamos el rango si la URL trae `?rango=`. Si no, "all" por defecto.
    const rangoParam = qp.get('rango');
    if (rangoParam === '7d' || rangoParam === '30d' || rangoParam === '90d') {
      this.rangoActivo = rangoParam;
    }

    this.cargarTodo(idVideo);
  }

  /** Cambia el preset de fecha y vuelve a pedir logs al backend. */
  cambiarRango(r: '7d' | '30d' | '90d' | 'all'): void {
    if (this.rangoActivo === r) return;
    this.rangoActivo = r;
    if (this.idVideo != null) this.cargarTodo(this.idVideo);
  }

  private rangoDesde(): string | null {
    const dias: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, 'all': null };
    const n = dias[this.rangoActivo];
    if (n == null) return null;
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  private cargarTodo(idVideo: number): void {
    this.cargando = true;
    this.cdr.markForCheck();

    const desde = this.rangoDesde();
    // En modo "grupo" pedimos los logs YA filtrados por el backend (que
    // además autoriza por rol del grupo). En modo global pedimos todos los
    // logs y dejamos que el desplegable filtre en cliente.
    const logs$ = this.fromGrupo && this.grupoIdCtx != null
      ? this.analiticasService.getLogsDelVideo(idVideo, this.grupoIdCtx, { desde })
      : this.analiticasService.getLogsDelVideo(idVideo, null, { desde });

    // Para los metadatos del vídeo (título, miniatura, duración):
    //  - Si vienes de un grupo, lo buscamos en los vídeos compartidos con
    //    ese grupo (el usuario puede no ser propietario).
    //  - Si vienes de "Mis vídeos", lo buscamos en obtenerMisVideos.
    const videos$: Observable<Video[]> = this.fromGrupo && this.grupoIdCtx != null
      ? this.videoService.obtenerVideosPorGrupo(this.grupoIdCtx)
      : this.videoService.obtenerMisVideos();

    combineLatest([videos$, logs$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([videos, logs]) => {
          const v = videos.find(x => x.idVideo === idVideo) ?? null;
          if (!v) {
            this.redirigirNoAutorizado();
            return;
          }
          this.video    = v;
          this.logs     = logs;
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 403 || err.status === 404) {
            this.redirigirNoAutorizado();
            return;
          }
          this.error    = 'No se pudieron cargar las analíticas del vídeo.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });
  }

  private redirigirNoAutorizado(): void {
    // Volvemos al origen razonable: al grupo si veníamos de él, al panel
    // global si no.
    if (this.fromGrupo && this.grupoIdCtx != null) {
      this.router.navigate(['/mi-espacio/grupos', this.grupoIdCtx], {
        queryParams: { aviso: 'sin-acceso-analiticas' },
      });
    } else {
      this.router.navigate(['/mi-espacio/videos'], {
        queryParams: { aviso: 'sin-acceso-analiticas' },
      });
    }
  }

  /** Ruta del back-link: al grupo si vienes de él, al panel global si no. */
  get backLink(): unknown[] {
    return this.fromGrupo && this.grupoIdCtx != null
      ? ['/mi-espacio/grupos', this.grupoIdCtx]
      : ['/mi-espacio/analiticas'];
  }

  get backLabel(): string {
    return this.fromGrupo ? 'Volver al grupo' : 'Volver';
  }

  /** % de retención individual: segundos vistos en esta sesión / duración. */
  retencionPct(segundos: number | null): number {
    const dur = this.video?.duracion ?? 0;
    if (!segundos || dur <= 0) return 0;
    return Math.min(Math.round((segundos / dur) * 100), 100);
  }

  get logsFiltrados(): VideoLog[] {
    if (this.filtroGrupo === 'all')  return this.logs;
    if (this.filtroGrupo === 'none') return this.logs.filter(l => l.grupoId == null);
    return this.logs.filter(l => l.grupoId === this.filtroGrupo);
  }

  /**
   * Grupos disponibles en el desplegable. Combina los grupos a los que
   * pertenece el vídeo hoy con los que aparecen en logs huérfanos (vídeo ya
   * desvinculado del grupo o grupo eliminado).
   *
   * En modo "from=grupo" el desplegable se inhabilita en el HTML porque el
   * backend solo devuelve los logs de ese grupo y no tendría sentido
   * cambiar el filtro.
   */
  get gruposDisponibles(): GrupoRef[] {
    const fromVideo = this.video?.grupos ?? [];
    const fromLogs = new Map<number, string>();
    for (const l of this.logs) {
      if (l.grupoId != null && !fromLogs.has(l.grupoId)) {
        fromLogs.set(l.grupoId, l.grupoNombre ?? 'Grupo eliminado');
      }
    }
    fromVideo.forEach(g => fromLogs.delete(g.idGrupo));
    const huerfanos = [...fromLogs.entries()].map(([idGrupo, nombre]) => ({ idGrupo, nombre }));
    return [...fromVideo, ...huerfanos];
  }

  get hayLogsSinGrupo(): boolean {
    return this.logs.some(l => l.grupoId == null);
  }

  /** Opciones del desplegable de filtro de grupo para app-custom-select. */
  get filtroGrupoOptions(): SelectOption[] {
    const opts: SelectOption[] = [{ value: 'all', label: 'Todos los contextos' }];
    if (this.hayLogsSinGrupo) {
      opts.push({ value: 'none', label: 'Sin grupo (visualización directa)' });
    }
    for (const g of this.gruposDisponibles) {
      opts.push({ value: g.idGrupo, label: g.nombre });
    }
    return opts;
  }

  /** Nombre del grupo de contexto, para mostrar en la cabecera. */
  get nombreGrupoCtx(): string | null {
    if (this.grupoIdCtx == null) return null;
    const fromVideo = this.video?.grupos.find(g => g.idGrupo === this.grupoIdCtx);
    if (fromVideo) return fromVideo.nombre;
    const fromLog = this.logs.find(l => l.grupoId === this.grupoIdCtx);
    return fromLog?.grupoNombre ?? null;
  }

  // ── KPIs (sobre los logs filtrados) ────────────────────────────────────

  get totalRegistros(): number {
    return this.logsFiltrados.length;
  }

  get espectadoresUnicos(): number {
    return new Set(this.logsFiltrados.map(l => l.idUsuario)).size;
  }

  get tiempoTotalVisto(): number {
    return this.logsFiltrados.reduce((s, l) => s + (l.segundosVistos ?? 0), 0);
  }

  /** Duración media por sesión — la métrica honesta, sin sumar sesiones distintas. */
  get duracionMediaSegundos(): number {
    const filas = this.logsFiltrados;
    if (!filas.length) return 0;
    return Math.round(filas.reduce((s, l) => s + (l.segundosVistos ?? 0), 0) / filas.length);
  }
}
