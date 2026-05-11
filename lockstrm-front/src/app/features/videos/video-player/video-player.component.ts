import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { AuthService } from '../../../core/services/auth.service';
import { VideoService } from '../../../core/services/video.service';
import { VideoStreamService } from '../../../core/services/video-stream.service';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [VideoDurationPipe],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayerComponent implements OnInit {

  // Entradas / Salidas

  /** Nombre de fichero UUID devuelto por el backend. La URL final del <video> la resuelve VideoStreamService. */
  readonly fileName = input.required<string>();

  readonly idVideo = input<number>();

  /**
   * Grupo desde el que se reproduce el vídeo. Puede ser null si la reproducción
   * ocurre fuera de un contexto de grupo. Se envía en cada heartbeat para que
   * el backend segmente las analíticas por grupo.
   */
  readonly grupoId = input<number | null | undefined>();

  /** Emite cada 5 s mientras el vídeo se reproduce; el padre lo reenvía al endpoint de heartbeat. */
  @Output() heartbeat = new EventEmitter<{
    currentTime: number;
    sessionId:   string;
    grupoId:     number | null;
  }>();

  /** UUID generado una sola vez por instancia del reproductor: identifica la sesión de visionado. */
  private readonly sessionId: string = this.generateSessionId();

  // Referencias del template

  @ViewChild('videoEl',         { static: true }) private videoRef!:     ElementRef<HTMLVideoElement>;
  @ViewChild('playerContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;

  // Inyección de dependencias

  private readonly authService        = inject(AuthService);
  private readonly videoService       = inject(VideoService);
  private readonly videoStreamService = inject(VideoStreamService);
  private readonly destroyRef         = inject(DestroyRef);

  // URL de streaming

  /** URL que se asigna al <video src=...>. La resuelve VideoStreamService (SW proxy o ticket firmado). */
  readonly streamUrl = signal<string>('');

  // Signals de estado

  readonly isPlaying    = signal(false);
  readonly isMuted      = signal(false);
  readonly volume       = signal(1);
  readonly currentTime  = signal(0);
  readonly duration     = signal(0);
  readonly isFullscreen = signal(false);
  readonly showControls = signal(true);

  /** isDragging bloquea las actualizaciones de timeupdate mientras el usuario arrastra el slider. */
  readonly isDragging = signal(false);
  readonly scrubValue = signal(0);

  /** true mientras el navegador está esperando datos (buffering HTTP 206). */
  readonly isBuffering = signal(false);

  /** true cuando el elemento <video> dispara un evento 'error' (stream no disponible). */
  readonly videoError = signal(false);

  /** Activa el icono central de play/pause durante 500 ms para dar feedback visual. */
  readonly showClickFlash = signal(false);

  /** Posición de la marca de agua en porcentajes. */
  readonly watermarkPos = signal({ top: '10%', left: '5%' });

  // Valores derivados (computed)

  /** Porcentaje 0-100 usado para pintar la barra de progreso. */
  readonly progressPercent = computed(() =>
    this.duration() > 0 ? (this.currentTime() / this.duration()) * 100 : 0
  );

  /** Identificador mostrado en la marca de agua: email del JWT, o username si la decodificación falla. */
  readonly userIdentifier: string;

  // Privado

  private hideControlsTimer: ReturnType<typeof setTimeout> | null = null;
  private clickFlashTimer:  ReturnType<typeof setTimeout> | null = null;

  // Ciclo de vida

  constructor() {
    this.userIdentifier = this.resolveUserIdentifier();

    this.destroyRef.onDestroy(() => {
      if (this.hideControlsTimer) clearTimeout(this.hideControlsTimer);
      if (this.clickFlashTimer)  clearTimeout(this.clickFlashTimer);
    });
  }

  ngOnInit(): void {
    this.initStreamUrl();
    this.initHeartbeat();
    this.initWatermark();
    this.initFullscreenListener();
    const id = this.idVideo();
    if (id != null) {
      this.videoService.registrarVista(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => {} });
    }
  }

  /**
   * Resuelve la URL de streaming asíncronamente. Mientras se resuelve, el
   * <video> queda con src="" (no carga). En cuanto se obtiene, el signal
   * dispara la asignación reactiva de [src] y el navegador inicia el fetch.
   */
  private initStreamUrl(): void {
    this.videoStreamService.buildUrl(this.fileName())
      .then(url => this.streamUrl.set(url))
      .catch(() => this.videoError.set(true));
  }

  // Helpers de inicialización

  /**
   * Heartbeat reactivo gobernado por eventos del <video>: play arranca un timer
   * de 5 s que emite al padre; pause/ended lo corta. Como máximo 1 HTTP cada 5 s.
   */
  private initHeartbeat(): void {
    const video  = this.videoRef.nativeElement;
    const play$  = fromEvent(video, 'play');
    const stop$  = merge(fromEvent(video, 'pause'), fromEvent(video, 'ended'));

    play$.pipe(
      switchMap(() => timer(0, 5_000).pipe(takeUntil(stop$))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.heartbeat.emit({
        currentTime: Math.round(video.currentTime),
        sessionId:   this.sessionId,
        grupoId:     this.grupoId() ?? null,
      });
    });
  }

  /** Genera un UUID v4 usando crypto.randomUUID, con fallback a getRandomValues si no está disponible. */
  private generateSessionId(): string {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID();
    }
    if (cryptoObj?.getRandomValues) {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }

  /** Mueve la marca de agua a una posición aleatoria cada 10 s. */
  private initWatermark(): void {
    timer(0, 10_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.watermarkPos.set({
          top:  `${Math.floor(Math.random() * 75)}%`,
          left: `${Math.floor(Math.random() * 70)}%`,
        });
      });
  }

  /** Sincroniza isFullscreen con el evento DOM nativo fullscreenchange. */
  private initFullscreenListener(): void {
    fromEvent(document, 'fullscreenchange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.isFullscreen.set(!!document.fullscreenElement));
  }

  /** Decodifica el JWT para obtener el email (claim `sub`). Convierte base64url → base64 antes de atob(). */
  private resolveUserIdentifier(): string {
    const token = this.authService.getToken();
    if (token) {
      try {
        const part    = token.split('.')[1] ?? '';
        const b64     = part.replace(/-/g, '+').replace(/_/g, '/');
        const pad     = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
        const payload = JSON.parse(atob(b64 + pad));
        if (payload.sub) return payload.sub;
      } catch { /* si falla, usamos el username almacenado */ }
    }
    return this.authService.getUser()?.username ?? 'Lockstrm';
  }

  // Manejadores de eventos del <video>

  onLoadedMetadata(): void {
    const video = this.videoRef.nativeElement;
    this.duration.set(video.duration);

    const savedSpeed = parseFloat(localStorage.getItem(STORAGE_KEYS.speed) ?? '1');
    if (!isNaN(savedSpeed)) video.playbackRate = savedSpeed;

    const memoryEnabled = localStorage.getItem(STORAGE_KEYS.volumeMemory) !== 'false';
    if (memoryEnabled) {
      const savedVolume = parseFloat(localStorage.getItem(STORAGE_KEYS.volume) ?? '1');
      if (!isNaN(savedVolume)) {
        video.volume = savedVolume;
        video.muted  = savedVolume === 0;
        this.volume.set(savedVolume);
        this.isMuted.set(savedVolume === 0);
      }
    }

    if (localStorage.getItem(STORAGE_KEYS.autoplay) !== 'false') {
      video.play().then(() => this.isPlaying.set(true)).catch(() => {});
    }
  }

  /**
   * Si el usuario está arrastrando el slider (isDragging), ignoramos timeupdate
   * para que no compita con la posición del ratón y el thumb no salte.
   */
  onTimeUpdate(): void {
    if (!this.isDragging()) {
      this.currentTime.set(this.videoRef.nativeElement.currentTime);
    }
  }

  onEnded(): void {
    this.isPlaying.set(false);
    this.isBuffering.set(false);
    this.showControls.set(true);
    if (this.hideControlsTimer) clearTimeout(this.hideControlsTimer);
  }

  /** Evento 'waiting' del <video>: el navegador está esperando datos. */
  onWaiting(): void {
    this.isBuffering.set(true);
  }

  /** Evento 'canplay' del <video>: ya hay datos suficientes para reanudar. */
  onCanPlay(): void {
    this.isBuffering.set(false);
  }

  /** Evento 'error' del <video>: stream 404, token expirado o caída de red. */
  onVideoError(): void {
    this.isBuffering.set(false);
    this.isPlaying.set(false);
    this.videoError.set(true);
  }

  // Controles de reproducción

  togglePlay(): void {
    const video = this.videoRef.nativeElement;
    if (video.paused) {
      video.play()
        .then(() => this.isPlaying.set(true))
        .catch(() => this.isPlaying.set(false));
    } else {
      video.pause();
      this.isPlaying.set(false);
    }
    this.triggerClickFlash();
  }

  /** Muestra el icono central de play/pause durante 500 ms tras pulsar. */
  private triggerClickFlash(): void {
    if (this.clickFlashTimer) clearTimeout(this.clickFlashTimer);
    this.showClickFlash.set(true);
    this.clickFlashTimer = setTimeout(() => this.showClickFlash.set(false), 500);
  }

  toggleMute(): void {
    const next = !this.isMuted();
    this.videoRef.nativeElement.muted = next;
    this.isMuted.set(next);
  }

  onVolumeChange(event: Event): void {
    const raw   = +(event.target as HTMLInputElement).value; // 0-100
    const value = raw / 100;                                  // 0-1
    const video = this.videoRef.nativeElement;
    video.volume = value;
    video.muted  = value === 0;
    this.volume.set(value);
    this.isMuted.set(value === 0);

    if (localStorage.getItem(STORAGE_KEYS.volumeMemory) !== 'false') {
      localStorage.setItem(STORAGE_KEYS.volume, String(value));
    }
  }

  // Arrastre de la barra de progreso

  /** Pulsa el thumb: activa isDragging para que onTimeUpdate no compita con el ratón. */
  onScrubStart(): void {
    this.isDragging.set(true);
    this.scrubValue.set(this.currentTime());
  }

  /** Mueve el thumb: actualiza scrubValue y hace seek en vivo para preview. */
  onScrubInput(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.scrubValue.set(value);
    this.videoRef.nativeElement.currentTime = value;
  }

  /** Suelta el thumb: seek final, baja isDragging y resincroniza currentTime. */
  onScrubEnd(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.videoRef.nativeElement.currentTime = value;
    this.currentTime.set(value);
    this.isDragging.set(false);
  }

  // Pantalla completa

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.containerRef.nativeElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Visibilidad de los controles

  onMouseMove(): void {
    this.showControls.set(true);
    if (this.hideControlsTimer) clearTimeout(this.hideControlsTimer);
    if (this.isPlaying()) {
      this.hideControlsTimer = setTimeout(() => this.showControls.set(false), 3000);
    }
  }

  onMouseLeave(): void {
    if (this.isPlaying()) {
      this.showControls.set(false);
    }
  }

  // Seguridad

  /** Bloquea el menú contextual nativo del navegador ("Guardar vídeo como…"). */
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

}
