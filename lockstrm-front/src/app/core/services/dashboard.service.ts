import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface VideoResumen {
  idVideo:      number;
  titulo:       string;
  duracion:     number | null;
  miniaturaUrl: string | null;
  vistas:       number;
  fechaSubida:  string | null;
}

export interface DashboardStats {
  totalVideos:  number;
  totalVistas:  number;
  totalGrupos:  number;
  topVistos:    VideoResumen[];
  topRecientes: VideoResumen[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {

  private readonly apiUrl = `${environment.apiUrl}/api/dashboard`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`);
  }
}
