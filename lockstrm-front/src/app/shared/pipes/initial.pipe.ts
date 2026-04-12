import { Pipe, PipeTransform } from '@angular/core';

/**
 * Devuelve la inicial en mayúscula de un texto.
 * Usado para los avatares de grupo.
 *
 * Uso: {{ grupo.nombre | initial }}
 */
@Pipe({ name: 'initial', standalone: true })
export class InitialPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value?.charAt(0)?.toUpperCase() ?? '?';
  }
}
