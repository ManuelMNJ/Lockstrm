import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GrupoService {

  private readonly apiUrl = 'http://localhost:8080/api/grupos';

  constructor(private http: HttpClient) {}

  obtenerMisGrupos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}
