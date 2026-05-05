import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: unknown;
  label: string;
  disabled?: boolean;
}

/**
 * Desplegable totalmente estilizado con el sistema de diseño de Lockstrm.
 * Reemplaza al <select> nativo para evitar el renderizado del sistema operativo.
 *
 * Uso básico:
 *   <app-custom-select [(ngModel)]="valor" [options]="opciones" />
 *
 * Variantes:
 *   size="sm"      — compacto (h 30 px, fuente 12 px bold)
 *   size="md"      — estándar (h 32 px, fuente 12 px)  ← por defecto
 *   variant="pill" — pastilla morada (para selectores de rol)
 */
@Component({
  selector: 'app-custom-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CustomSelectComponent),
    multi: true,
  }],
  template: `
    <div class="cs-wrap"
         [class.cs-open]="isOpen"
         [class.cs-disabled]="isDisabled"
         [class.cs-sm]="size === 'sm'"
         [class.cs-pill]="variant === 'pill'"
         [class.cs-full]="fullWidth">

      <button type="button"
              class="cs-trigger"
              [attr.aria-expanded]="isOpen"
              [attr.aria-label]="ariaLabel || null"
              [disabled]="isDisabled || null"
              (click)="toggle()">
        <span class="cs-label">{{ selectedLabel }}</span>
        <svg class="cs-caret" viewBox="0 0 16 16" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      @if (isOpen) {
        <div class="cs-panel" role="listbox">
          @for (opt of options; track opt.value) {
            <div class="cs-option"
                 role="option"
                 [class.cs-option--active]="opt.value === selectedValue"
                 [class.cs-option--disabled]="opt.disabled"
                 [attr.aria-selected]="opt.value === selectedValue"
                 (click)="select(opt)">
              <svg class="cs-tick" viewBox="0 0 16 16" fill="none"
                   stroke="currentColor" stroke-width="2.2"
                   stroke-linecap="round" stroke-linejoin="round"
                   aria-hidden="true"
                   [style.visibility]="opt.value === selectedValue ? 'visible' : 'hidden'">
                <polyline points="3 8 6.5 11.5 13 5"/>
              </svg>
              {{ opt.label }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    /* ── Contenedor ──────────────────────────────────────────────────────── */
    .cs-wrap {
      position: relative;
      display: inline-flex;
      flex-direction: column;
    }

    /* ── Botón disparador ────────────────────────────────────────────────── */
    .cs-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      height: 32px;
      padding: 0 10px;
      min-width: 200px;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition:
        border-color     var(--transition-fast),
        background-color var(--transition-fast),
        box-shadow       var(--transition-fast);
    }

    .cs-trigger:hover {
      border-color: var(--color-primary);
      background-color: var(--bg-surface-hover);
    }

    .cs-open .cs-trigger {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-ghost);
    }

    /* ── Texto del valor seleccionado ─────────────────────────────────────  */
    .cs-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Chevron ──────────────────────────────────────────────────────────── */
    .cs-caret {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      color: var(--text-subtle);
      transition: transform var(--transition-fast), color var(--transition-fast);
    }

    .cs-trigger:hover .cs-caret,
    .cs-open .cs-caret {
      color: var(--color-primary);
    }

    .cs-open .cs-caret {
      transform: rotate(180deg);
    }

    /* ── Tamaño sm (ordenar / filtros compactos) ─────────────────────────── */
    .cs-sm .cs-trigger {
      height: 30px;
      min-width: unset;
      font-size: 12px;
      font-weight: 600;
    }

    .cs-sm .cs-option {
      font-size: 12px;
      padding: 6px 10px;
    }

    /* ── Variante pill (selector de rol de miembro) ───────────────────────  */
    .cs-pill .cs-trigger {
      height: 28px;
      min-width: 108px;
      border-radius: 9999px;
      border-color: var(--color-primary);
      background-color: var(--color-primary-ghost);
      color: var(--color-primary);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }

    .cs-pill .cs-trigger:hover {
      background-color: var(--color-primary-a25);
      border-color: var(--color-primary-hover);
    }

    .cs-pill.cs-open .cs-trigger {
      background-color: var(--color-primary-a25);
    }

    .cs-pill .cs-caret { color: var(--color-primary); }
    .cs-pill .cs-trigger:hover .cs-caret { color: var(--color-primary-hover); }

    /* ── Disabled ─────────────────────────────────────────────────────────── */
    .cs-disabled .cs-trigger {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* ── Panel desplegable ────────────────────────────────────────────────── */
    .cs-panel {
      position: absolute;
      top: calc(100% + 5px);
      left: 0;
      min-width: 100%;
      background-color: var(--bg-surface);
      border: 1px solid var(--color-primary-a30);
      border-radius: var(--radius-md);
      box-shadow:
        0 10px 32px rgba(0, 0, 0, 0.45),
        0 0 0 1px var(--color-primary-a12);
      z-index: 999;
      overflow: hidden;
      animation: cs-in 0.1s ease;
    }

    @keyframes cs-in {
      from { opacity: 0; transform: translateY(-5px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Opción ───────────────────────────────────────────────────────────── */
    .cs-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--text-main);
      cursor: pointer;
      white-space: nowrap;
      transition: background-color var(--transition-fast), color var(--transition-fast);
    }

    .cs-option:hover:not(.cs-option--disabled) {
      background-color: var(--color-primary-a12);
      color: var(--color-primary-lightest);
    }

    .cs-option--active {
      color: var(--color-primary-lighter);
      background-color: var(--color-primary-a08);
    }

    .cs-option--active:hover {
      background-color: var(--color-primary-a15);
    }

    .cs-option--disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Tick de opción seleccionada ──────────────────────────────────────── */
    .cs-tick {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      color: var(--color-primary);
    }

    /* ── Panel más ancho en pill para caber los nombres de rol ───────────── */
    .cs-pill .cs-panel { min-width: 160px; }

    /* ── Full-width (para desplegables dentro de filas flex) ─────────────── */
    .cs-full { flex: 1; min-width: 0; }
    .cs-full .cs-trigger { min-width: 0; }
  `],
})
export class CustomSelectComponent implements ControlValueAccessor {

  @Input() options: SelectOption[] = [];
  @Input() placeholder = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() variant: 'default' | 'pill' = 'default';
  @Input() ariaLabel = '';
  /** Expands the trigger + panel to fill the parent's available width. */
  @Input() fullWidth = false;

  /** Allows `[disabled]="expr"` bindings without reactive forms. */
  @Input() set disabled(val: boolean) {
    this.isDisabled = val;
    this.cdr.markForCheck();
  }

  isOpen     = false;
  isDisabled = false;
  selectedValue: unknown = null;

  private onChange   = (_: unknown) => {};
  private onTouched  = () => {};

  constructor(private el: ElementRef, private cdr: ChangeDetectorRef) {}

  get selectedLabel(): string {
    return this.options.find(o => o.value === this.selectedValue)?.label
      ?? this.placeholder;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.cdr.markForCheck();
  }

  select(opt: SelectOption): void {
    if (opt.disabled) return;
    this.selectedValue = opt.value;
    this.onChange(opt.value);
    this.onTouched();
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (this.isOpen && !this.el.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.isOpen = false;
      this.cdr.markForCheck();
    }
  }

  writeValue(value: unknown): void {
    this.selectedValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void  { this.onChange  = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }
}
