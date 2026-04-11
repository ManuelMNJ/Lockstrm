import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Patrón canónico de fortaleza: ≥8 chars, 1 mayúscula, 1 dígito, 1 carácter especial. */
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

/**
 * Valida que el valor del control cumpla el patrón de fortaleza de Lockstrm.
 * Retorna `{ passwordDebil: true }` si falla; null si es válido o está vacío
 * (Validators.required se encarga del caso vacío por separado).
 */
export function passwordFortalezaValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) return null;
    return PASSWORD_PATTERN.test(value) ? null : { passwordDebil: true };
  };
}

/**
 * Validador a nivel de FormGroup que comprueba que dos campos de contraseña coincidan.
 * @param campoNueva    - nombre del control con la contraseña nueva
 * @param campoConfirm  - nombre del control de confirmación
 */
export function confirmarPasswordValidator(
  campoNueva: string,
  campoConfirm: string,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const nueva   = group.get(campoNueva)?.value  ?? '';
    const confirm = group.get(campoConfirm)?.value ?? '';
    if (!nueva || !confirm) return null;
    return nueva === confirm ? null : { passwordNoCoincide: true };
  };
}

/** Evalúa cada requisito por separado para alimentar la checklist del template. */
export function calcPwReqs(value: string) {
  return {
    length:    value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    number:    /\d/.test(value),
    special:   /[^A-Za-z\d]/.test(value),
  };
}
