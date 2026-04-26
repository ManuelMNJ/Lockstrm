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
import { combineLatest } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { VideoService, Video, GrupoRef } from '../../../core/services/video.service';
import { AnaliticasService, VideoLog } from '../../../core/services/analiticas.service';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-analiticas-video',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, VideoDurationPipe],
  templateUrl: './analiticas-video.component.html',
  styleUrl: './analiticas-video.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliticasVideoComponent implements OnInit {

  video:     Video | null = null;
  /**
   * Logs sin filtrar (todos los del vídeo). El filtro por grupo se aplica en
   * memoria con `logsFiltrados` para que el desplegable cambie la vista
   * instantáneamente sin nuevas peticiones HTTP. Si el set crece mucho,
   * pasamos a refetchear con ?grupoId.
   */
  logs:      VideoLog[]   = [];
  cargando   = true;
  error      = '';

  /**
   * Filtro activo de grupo:
   *  - 'all'   → todas las visualizaciones
   *  - 'none'  → solo las reproducciones sin contexto de grupo (grupoId = null)
   *  - número  → un grupo concreto
   */
  filtroGrupo: 'all' | 'none' | number = 'all';

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

    // Si la vista se abre desde un grupo concreto, ese contexto pre-selecciona
    // el filtro pero NO restringe la consulta: pedimos todos los logs para
    // que el usuario pueda cambiar de filtro en el desplegable sin refetch.
    const grupoIdParam = this.route.snapshot.queryParamMap.get('grupoId');
    if (grupoIdParam != null) {
      this.filtroGrupo = Number(grupoIdParam);
    }

    combineLatest([
      this.videoService.obtenerMisVideos(),
      this.analiticasService.getLogsDelVideo(idVideo),
    ]).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([videos, logs]) => {
          const propio = videos.find(v => v.idVideo === idVideo) ?? null;
          if (!propio) {
            // Seguridad en profundidad: el back ya devuelve 403, pero si por
            // cualquier motivo los logs llegaron sin el vídeo en la lista
            // propia, no mostramos analíticas de un vídeo que no es nuestro.
            this.redirigirNoAutorizado();
            return;
          }
          this.video    = propio;
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
    this.router.navigate(['/mi-espacio/videos'], {
      queryParams: { aviso: 'sin-acceso-analiticas' },
    });
  }

  /** % de retención individual: segundos vistos en esta sesión / duración. */
  retencionPct(segundos: number | null): number {
    const dur = this.video?.duracion ?? 0;
    if (!segundos || dur <= 0) return 0;
    return Math.min(Math.round((segundos / dur) * 100), 100);
  }

  /**
   * Logs aplicando el filtro de grupo activo. Se evalúa sobre cada cambio
   * de `filtroGrupo` o de `logs`; al ser un getter no requiere recomputación
   * manual.
   */
  get logsFiltrados(): VideoLog[] {
    if (this.filtroGrupo === 'all')  return this.logs;
    if (this.filtroGrupo === 'none') return this.logs.filter(l => l.grupoId == null);
    return this.logs.filter(l => l.grupoId === this.filtroGrupo);
  }

  /**
   * Lista de grupos disponibles en el desplegable. Combina los grupos a los
   * que pertenece el vídeo HOY (con sus nombres canónicos) con cualquier
   * grupoId que aparezca en los logs y NO esté en esa lista — caso de un
   * grupo del que el vídeo fue desvinculado pero del que aún quedan
   * registros históricos. Esos se renderizan como "Grupo eliminado" o con el
   * nombre que el log preservó.
   */
  get gruposDisponibles(): GrupoRef[] {
    const fromVideo = this.video?.grupos ?? [];
    const fromLogs = new Map<number, string>();
    for (const l of this.logs) {
      if (l.grupoId != null && !fromLogs.has(l.grupoId)) {
        fromLogs.set(l.grupoId, l.grupoNombre ?? 'Grupo eliminado');
      }
    }
    // Quitamos los que ya están en `video.grupos` para no duplicar.
    fromVideo.forEach(g => fromLogs.delete(g.idGrupo));
    const huerfanos = [...fromLogs.entries()].map(([idGrupo, nombre]) => ({ idGrupo, nombre }));
    return [...fromVideo, ...huerfanos];
  }

  /** True si en los logs hay al menos una sesión sin contexto de grupo. */
  get hayLogsSinGrupo(): boolean {
    return this.logs.some(l => l.grupoId == null);
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
}
