import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Convierte el valor `miniaturaUrl` devuelto por el backend en una URL
 * utilizable como `[src]` de un `<img>`:
 *
 * - `null` / vacío → `null` (sin imagen).
 * - Empieza con `data:` → base64 heredado almacenado directamente; se devuelve
 *   tal cual para mantener compatibilidad con los vídeos subidos antes de la
 *   migración a almacenamiento en disco.
 * - Cualquier otro valor → ruta relativa del endpoint de miniaturas, p.ej.
 *   `/api/videos/thumbnails/uuid.jpg`; se antepone `environment.apiUrl`
 *   para obtener la URL absoluta.
 */
@Pipe({
  name:       'thumbnailSrc',
  standalone: true,
  pure:       true,
})
export class ThumbnailSrcPipe implements PipeTransform {

  transform(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('data:')) return url;              // legacy base64
    return `${environment.apiUrl}${url}`;                 // /api/videos/thumbnails/…
  }
}
