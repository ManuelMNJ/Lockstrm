// =============================================================================
// Lockstrm — VideoService
// Ruta: src/app/core/services/video.service.ts
// Servicio global para comunicación con la API de vídeos del backend.
// =============================================================================
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VideoService {

  // Ruta del Backend en Java
  private apiUrl = 'http://localhost:8080/api/videos';

  constructor(private http: HttpClient) { }

  // Método para empaquetar y subir el archivo
  subirVideo(archivo: File, idUsuario: number, titulo: string, duracion: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('idUsuario', idUsuario.toString());
    formData.append('titulo', titulo);
    formData.append('duracion', duracion.toString());

    return this.http.post(`${this.apiUrl}/subir`, formData);
  }

  // Método para obtener la lista de vídeos
  obtenerVideos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}
