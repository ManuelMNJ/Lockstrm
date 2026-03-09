import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../servicios/video.service';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css'
})
export class VideosComponent implements OnInit {
  
  videos: any[] = [];
  archivoSeleccionado: File | null = null;
  tituloVideo: string = '';
  
  subiendo: boolean = false;
  mensaje: string = '';

  constructor(private videoService: VideoService) {}

  ngOnInit(): void {
    this.cargarVideos();
  }

  seleccionarArchivo(event: any): void {
    this.archivoSeleccionado = event.target.files[0];
  }

  subir(): void {
    if (!this.archivoSeleccionado || !this.tituloVideo) {
      this.mensaje = 'Aviso: Falta el titulo o el video.';
      return;
    }

    const limiteMB = 95; 
    const limiteBytes = limiteMB * 1024 * 1024;

    if (this.archivoSeleccionado.size > limiteBytes) {
      this.mensaje = `Aviso: El video pesa demasiado. El limite para esta demo es de ${limiteMB} MB.`;
      return;
    }

    // Le pasamos un 1 por defecto por si todavia no tienes el login conectado al 100%
    const idUsuario = 1; 

    this.subiendo = true;
    this.mensaje = 'Subiendo a Cloudinary... Espera por favor.';

    this.videoService.subirVideo(this.archivoSeleccionado, idUsuario, this.tituloVideo, 0).subscribe({
      next: (respuesta) => {
        this.mensaje = 'Video subido correctamente';
        this.subiendo = false;
        this.tituloVideo = '';
        this.archivoSeleccionado = null;
        this.cargarVideos(); 
      },
      error: (error) => {
        this.mensaje = 'Error al subir. Mira la consola.';
        this.subiendo = false;
        console.error(error);
      }
    });
  }

  cargarVideos(): void {
    this.videoService.obtenerVideos().subscribe({
      next: (datos) => {
        this.videos = datos;
      },
      error: (error) => console.error(error)
    });
  }
}