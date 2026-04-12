import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { VideoService, Video } from '../../core/services/video.service';
import { VideoPlayerComponent } from '../videos/video-player/video-player.component';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-videos-compartidos',
  standalone: true,
  imports: [CommonModule, VideoPlayerComponent, VideoDurationPipe],
  templateUrl: './videos-compartidos.component.html',
  styleUrl: './videos-compartidos.component.css',
})
export class VideosCompartidosComponent implements OnInit {

  videos: Video[] = [];
  cargando = true;
  listaError = '';

  videoReproduciendose: Video | null = null;

  // ── Paginación ─────────────────────────────────────────────────────────────
  readonly PAGE_SIZE = 12;
  currentPage = 1;

  get paginatedVideos(): Video[] {
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    return this.videos.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.videos.length / this.PAGE_SIZE));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.cdr.detectChanges();
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
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.listaError = `No se pudo cargar el contenido (${err?.status ?? 'sin conexión'}). Recarga la página.`;
          this.cargando   = false;
          this.cdr.detectChanges();
        },
      });
  }

  abrirReproductor(video: Video): void {
    this.videoReproduciendose = video;
    this.cdr.detectChanges();
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.detectChanges();
  }

  onHeartbeat(currentTime: number): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;

    const segundos = Math.floor(currentTime);
    this.videoService.registrarHeartbeat(idVideo, segundos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err) => console.warn('[Heartbeat] Error al registrar:', err?.status, err?.message),
      });
  }
}
