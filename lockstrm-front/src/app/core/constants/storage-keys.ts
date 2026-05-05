/**
 * Claves de localStorage usadas en toda la aplicación.
 * Importar desde aquí en lugar de hardcodear strings en los componentes
 * para que un cambio de nombre se propague de forma segura.
 */
export const STORAGE_KEYS = {
  /** Tema de la interfaz: 'dark' | 'light' */
  theme:        'lockstrm-theme',
  /** Autoplay del reproductor: 'true' | 'false' */
  autoplay:     'lockstrm-autoplay',
  /** Velocidad por defecto del reproductor: '0.5' | '0.75' | '1' | … */
  speed:        'lockstrm-default-speed',
  /** Memoria de volumen del reproductor: 'true' | 'false' */
  volumeMemory: 'lockstrm-volume-memory',
  /** Sesión autenticada serializada como JSON (AuthResponse) */
  user:         'usuarioLogueado',
} as const;
