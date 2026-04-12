/**
 * Clase utilitaria de paginación genérica.
 *
 * Uso en un componente:
 *   paginator = new Paginator<Video>(15);
 *   this.paginator.setItems(videos);          // cargar/recargar datos
 *   this.paginator.page                       // página actual (1-based)
 *   this.paginator.paginatedItems             // slice visible
 *   this.paginator.totalPages
 *   this.paginator.pages                      // array [1..N] para ngFor
 *   this.paginator.goToPage(n)
 */
export class Paginator<T> {

  private _items: T[] = [];
  page = 1;

  constructor(readonly pageSize: number) {}

  setItems(items: T[]): void {
    this._items = items;
    this.page   = 1;
  }

  get paginatedItems(): T[] {
    const start = (this.page - 1) * this.pageSize;
    return this._items.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this._items.length / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get totalItems(): number {
    return this._items.length;
  }

  goToPage(page: number): void {
    this.page = Math.max(1, Math.min(page, this.totalPages));
  }
}
