import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte una duración en segundos a texto legible.
 *
 * @param padMinutes  true → MM:SS (p.ej. 01:05), false (default) → M:SS (p.ej. 1:05)
 *
 * Uso en listas:   {{ video.duracion | videoDuration }}          → "1:05"
 * Uso en player:   {{ currentTime() | videoDuration:true }}      → "01:05"
 */
@Pipe({ name: 'videoDuration', standalone: true })
export class VideoDurationPipe implements PipeTransform {
  transform(segundos: number | null | undefined, padMinutes = false): string {
    if (segundos == null || segundos < 0) return '—';
    const s = Math.floor(segundos);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const minStr = padMinutes ? m.toString().padStart(2, '0') : m.toString();
    return `${minStr}:${sec.toString().padStart(2, '0')}`;
  }
}
