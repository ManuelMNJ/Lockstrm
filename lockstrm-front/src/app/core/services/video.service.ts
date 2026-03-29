import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VideoService {

  private readonly apiUrl = 'http://localhost:8080/api/videos';

  constructor(private http: HttpClient) {}

  subirVideo(archivo: File, titulo: string, idGrupo?: number | null): Observable<unknown> {
    const formData = new FormData();
    formData.append('file',   archivo);
    formData.append('titulo', titulo);
    if (idGrupo != null) {
      formData.append('idGrupo', idGrupo.toString());
    }
    return this.http.post(`${this.apiUrl}/subir`, formData);
  }

  obtenerVideos(): Observable<unknown[]> {
    return this.http.get<unknown[]>(this.apiUrl);
  }
}
