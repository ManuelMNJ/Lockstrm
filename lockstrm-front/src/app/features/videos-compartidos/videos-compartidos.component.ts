import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { VideoService, Video } from '../../core/services/video.service';
import { VideoPlayerComponent } from '../videos/video-player/video-player.component';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { Paginator } from '../../shared/utils/paginator';

@Component({
  selector: 'app-videos-compartidos',
  standalone: true,
  imports: [VideoPlayerComponent, VideoDurationPipe],
  templateUrl: './videos-compartidos.component.html',
  styleUrl: './videos-compartidos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideosCompartidosComponent implements OnInit {

  videos: Video[] = [];
  cargando = true;
  listaError = '';

  videoReproduciendose: Video | null = null;

  readonly paginator = new Paginator<Video>(12);

  goToPage(page: number): void {
    this.paginator.goToPage(page);
    this.cdr.markForCheck();
  }

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(protected videoService: VideoService) {}

  ngOnInit(): void {
    this.cargarVideos();
  }

  cargarVideos(): void {
    this.listaError = '';
    this.cargando   = true;
    this.videoService.obtenerVideosCompartidos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.videos   = datos;
          this.paginator.setItems(datos);
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.listaError = `No se pudo cargar el contenido (${err?.status ?? 'sin conexión'}). Recarga la página.`;
          this.cargando   = false;
          this.cdr.markForCheck();
        },
      });
  }

  abrirReproductor(video: Video): void {
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
      .subscribe({
        error: (err) => console.warn('[Heartbeat] Error al registrar:', err?.status, err?.message),
      });
  }
}
