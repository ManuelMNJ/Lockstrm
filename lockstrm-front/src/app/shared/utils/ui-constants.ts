/**
 * Constantes de UI centralizadas.
 *
 * Convención de nombres del proyecto
 * ─────────────────────────────────
 * • Variables de estado de negocio / UI → español
 *   Ejemplos: `estadoSubida`, `modoEdicion`, `cargando`, `mensajeError`
 * • Dependencias de Angular, tipos del framework, inyecciones → inglés
 *   Ejemplos: `ChangeDetectorRef`, `DestroyRef`, `takeUntilDestroyed`, `inject`
 *
 * Mantener aquí todos los literales numéricos que controlan tiempos de feedback
 * y límites de ficheros para que un único cambio se propague a toda la app.
 */

/** Duraciones de temporización de UI (ms). */
export const UI_TIMINGS = {
  /** Pausa "Cerrando sesión…" / cierre automático de panel tras subida exitosa. */
  FEEDBACK_SHORT_MS:   2000,
  /** Banner de éxito antes de resetear al estado `idle`. */
  FEEDBACK_SUCCESS_MS: 3000,
  /** Toast de edición de vídeo exitosa. */
  TOAST_EDIT_MS:       3500,
  /** Toast de subida de vídeo exitosa. */
  TOAST_UPLOAD_MS:     4000,
  /** Toasts de error y avisos de acceso denegado. */
  TOAST_ERROR_MS:      6000,
  /** Retardo mínimo antes de hacer focus() sobre un elemento recién renderizado. */
  DOM_FOCUS_DELAY_MS:  50,
} as const;

/** Límites de ficheros aceptados por el backend. */
export const FILE_LIMITS = {
  VIDEO_MB:    200,
  VIDEO_BYTES: 200 * 1024 * 1024,
  /** Límite de avatar (referencia informativa; validación real en el backend). */
  AVATAR_MB:   5,
} as const;

/** Parámetros de paginación. */
export const PAGINATION = {
  VIDEOS_PAGE_SIZE: 15,
} as const;
