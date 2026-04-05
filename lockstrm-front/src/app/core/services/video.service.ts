import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface VideoUploadResponse {
  id_video: number;
  titulo: string;
  url: string;
  duracion: number;
  status: string;
  mensaje: string;
}

export interface Video {
  idVideo: number;
  titulo: string;
  duracion: number | null;
  urlCloudSecure: string;
  cloudinaryId: string;
  fechaSubida: string | null;
  uploadDate?: string | null;
  propietario?: { username: string };
  nombrePropietario?: string;
  ownerUsername?: string;
  grupo?: { nombre: string };
  nombreGrupo?: string;
  groupName?: string;
}

@Injectable({ providedIn: 'root' })
export class VideoService {

  private readonly apiUrl = `${environment.apiUrl}/api/videos`;

  constructor(private http: HttpClient) {}

  subirVideo(archivo: File, titulo: string, idGrupo?: number | null): Observable<VideoUploadResponse> {
    const formData = new FormData();
    formData.append('file',   archivo);
    formData.append('titulo', titulo);
    if (idGrupo != null) {
      formData.append('idGrupo', idGrupo.toString());
    }
    return this.http.post<VideoUploadResponse>(`${this.apiUrl}/subir`, formData);
  }

  obtenerVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(this.apiUrl);
  }

  eliminarVideo(idVideo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idVideo}`);
  }
}
