import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea una fecha ISO en locale es-ES.
 * Devuelve '—' para valores nulos o vacíos.
 *
 * monthStyle 'short' (defecto) → "15 mar 2025"
 * monthStyle 'long'            → "15 de marzo de 2025"
 *
 * Uso: {{ fecha | dateLocale }} · {{ fecha | dateLocale:'long' }}
 */
@Pipe({ name: 'dateLocale', standalone: true })
export class DateLocalePipe implements PipeTransform {
  transform(fecha: string | null | undefined, monthStyle: 'short' | 'long' = 'short'): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: monthStyle,
      year: 'numeric',
    });
  }
}
