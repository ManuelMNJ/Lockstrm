import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte una duración en segundos al formato M:SS.
 * Devuelve '—' para valores nulos o no positivos.
 *
 * Uso: {{ video.duracion | videoDuration }}
 */
@Pipe({ name: 'videoDuration', standalone: true })
export class VideoDurationPipe implements PipeTransform {
  transform(segundos: number | null | undefined): string {
    if (segundos == null || segundos <= 0) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
