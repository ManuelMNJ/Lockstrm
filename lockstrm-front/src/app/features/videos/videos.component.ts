import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../../core/services/video.service';
import { AuthService } from '../../core/services/auth.service';
import { GrupoService } from '../../core/services/grupo.service';

interface Video {
  idVideo: number;
  titulo: string;
  duracion: number | null;
  urlCloudSecure: string;
  cloudinaryId: string;
  fechaSubida: string | null;
  propietario?: { username: string };
  nombrePropietario?: string;
  ownerUsername?: string;
  grupo?: { nombre: string };
  nombreGrupo?: string;
  groupName?: string;
  uploadDate?: string;
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
  misGrupos: any[] = [];
  archivoSeleccionado: File | null = null;
  tituloVideo = '';
  idGrupoSeleccionado: number | null = null;

  estadoSubida: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  mensajeError = '';
  listaError   = '';

  videoReproduciendose: Video | null = null;

  @ViewChild('archivoInput') archivoInput!: ElementRef<HTMLInputElement>;

  // Forzamos la detección de cambios manualmente porque al subir archivos grandes
  // Angular pierde el rastro de la asincronía y la UI no se actualiza sola.
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private videoService: VideoService,
    private authService: AuthService,
    private grupoService: GrupoService
  ) {}

  ngOnInit(): void {
    this.cargarVideos();
    this.grupoService.obtenerMisGrupos().subscribe({
      next: (grupos) => {
        this.misGrupos = grupos;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('[VideosComponent] Error al cargar grupos:', err)
    });
  }

  seleccionarArchivo(event: Event): void {
    this.archivoSeleccionado = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  subir(): void {
    if (!this.archivoSeleccionado || !this.tituloVideo) {
      this.estadoSubida = 'error';
      this.mensajeError = 'Falta el titulo o el video.';
      return;
    }

    // 95 MB y no 100 para dejar margen: el contenedor multipart añade algo de peso extra
    // y Cloudinary nos corta la subida si llegamos justo al límite.
    const LIMITE_MB    = 95;
    const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

    if (this.archivoSeleccionado.size > LIMITE_BYTES) {
      this.estadoSubida = 'error';
      this.mensajeError = `El video supera el limite de ${LIMITE_MB} MB.`;
      return;
    }

    this.estadoSubida = 'uploading';
    this.mensajeError = '';

    this.videoService.subirVideo(this.archivoSeleccionado, this.tituloVideo, this.idGrupoSeleccionado).subscribe({
      next: () => {
        this.estadoSubida        = 'success';
        this.tituloVideo         = '';
        this.archivoSeleccionado = null;
        this.idGrupoSeleccionado = null;
        this.archivoInput.nativeElement.value = '';
        this.cargarVideos();
        this.cdr.detectChanges();
        // Le damos 3 segundos para que el usuario vea el mensaje de éxito antes de que el formulario se resetee.
        setTimeout(() => {
          this.estadoSubida = 'idle';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        this.estadoSubida = 'error';
        this.mensajeError = err?.error?.message || 'Error al subir. Comprueba la consola.';
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

  construirUrlStreaming(idVideo: number): string {
    const token = this.authService.getToken() ?? '';
    return `http://localhost:8080/api/videos/stream/${idVideo}?token=${token}`;
  }

  formatearDuracion(segundos: number | null | undefined): string {
    if (segundos == null || segundos <= 0) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
