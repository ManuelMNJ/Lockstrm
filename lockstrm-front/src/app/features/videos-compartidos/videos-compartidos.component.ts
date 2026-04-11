import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { VideoService, Video } from '../../core/services/video.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { VideoPlayerComponent } from '../videos/video-player/video-player.component';

@Component({
  selector: 'app-videos-compartidos',
  standalone: true,
  imports: [CommonModule, VideoPlayerComponent],
  templateUrl: './videos-compartidos.component.html',
  styleUrl: './videos-compartidos.component.css',
})
export class VideosCompartidosComponent implements OnInit {

  videos: Video[] = [];
  cargando = true;
  listaError = '';

  videoReproduciendose: Video | null = null;

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(
    private videoService: VideoService,
    private authService: AuthService,
  ) {}

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

  construirUrlStreaming(idVideo: number): string {
    const token = this.authService.getToken() ?? '';
    return `${environment.apiUrl}/api/videos/stream/${idVideo}?token=${token}`;
  }

  formatearDuracion(segundos: number | null | undefined): string {
    if (segundos == null || segundos <= 0) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  onHeartbeat(currentTime: number): void {
    console.log(`[Heartbeat] videoId=${this.videoReproduciendose?.idVideo} t=${Math.floor(currentTime)}s`);
  }
}
