import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../../core/services/video.service';

interface Video {
  idVideo: number;
  titulo: string;
  duracion: number | null;
  urlCloudSecure: string;
  cloudinaryId: string;
  fechaSubida: string | null;
}

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css'
})
export class VideosComponent implements OnInit {

  videos: Video[] = [];
  archivoSeleccionado: File | null = null;
  tituloVideo = '';

  uploadStatus: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  errorMessage = '';
  listaError   = '';

  videoReproduciendose: Video | null = null;

  @ViewChild('archivoInput') archivoInput!: ElementRef<HTMLInputElement>;

  private cdr = inject(ChangeDetectorRef);

  constructor(private videoService: VideoService) {}

  ngOnInit(): void {
    this.cargarVideos();
  }

  seleccionarArchivo(event: Event): void {
    this.archivoSeleccionado = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  subir(): void {
    if (!this.archivoSeleccionado || !this.tituloVideo) {
      this.uploadStatus = 'error';
      this.errorMessage = 'Falta el titulo o el video.';
      return;
    }

    const LIMITE_MB    = 95;
    const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

    if (this.archivoSeleccionado.size > LIMITE_BYTES) {
      this.uploadStatus = 'error';
      this.errorMessage = `El video supera el limite de ${LIMITE_MB} MB.`;
      return;
    }

    this.uploadStatus = 'uploading';
    this.errorMessage = '';

    this.videoService.subirVideo(this.archivoSeleccionado, this.tituloVideo).subscribe({
      next: () => {
        this.uploadStatus        = 'success';
        this.tituloVideo         = '';
        this.archivoSeleccionado = null;
        this.archivoInput.nativeElement.value = '';
        this.cargarVideos();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.uploadStatus = 'idle';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        this.uploadStatus = 'error';
        this.errorMessage = err?.error?.message || 'Error al subir. Comprueba la consola.';
        console.error('[VideosComponent] Error en subida:', {
          status:     err?.status,
          statusText: err?.statusText,
          message:    err?.message,
          body:       err?.error,
        });
        this.cdr.detectChanges();
      }
    });
  }

  cargarVideos(): void {
    this.listaError = '';
    this.videoService.obtenerVideos().subscribe({
      next: (datos) => {
        this.videos = datos as Video[];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.listaError = `No se pudo cargar la biblioteca (${err?.status ?? 'sin conexion'}). Recarga la pagina.`;
        console.error('[VideosComponent] Error al cargar videos:', err);
        this.cdr.detectChanges();
      }
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

  formatearDuracion(segundos: number | null | undefined): string {
    if (segundos == null || segundos <= 0) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
