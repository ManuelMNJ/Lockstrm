import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea una fecha ISO al estilo "15 mar 2025" en locale es-ES.
 * Devuelve '—' para valores nulos o vacíos.
 *
 * Uso: {{ grupo.fechaCreacion | dateLocale }}
 */
@Pipe({ name: 'dateLocale', standalone: true })
export class DateLocalePipe implements PipeTransform {
  transform(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
