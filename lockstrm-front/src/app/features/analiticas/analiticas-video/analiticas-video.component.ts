import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { VideoService, Video } from '../../../core/services/video.service';
import { AnaliticasService, VideoLog } from '../../../core/services/analiticas.service';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-analiticas-video',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, VideoDurationPipe],
  templateUrl: './analiticas-video.component.html',
  styleUrl: './analiticas-video.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliticasVideoComponent implements OnInit {

  video:     Video | null = null;
  logs:      VideoLog[]   = [];
  cargando   = true;
  error      = '';

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

  /** Totales agregados mostrados en la cabecera. */
  get totalRegistros(): number {
    return this.logs.length;
  }

  get espectadoresUnicos(): number {
    return new Set(this.logs.map(l => l.email)).size;
  }

  get tiempoTotalVisto(): number {
    return this.logs.reduce((s, l) => s + (l.segundosVistos ?? 0), 0);
  }
}
