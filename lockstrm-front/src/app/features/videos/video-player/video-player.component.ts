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

  // ── Inputs / Outputs ────────────────────────────────────────────────────────

  /**
   * Nombre de fichero UUID devuelto por el backend (ej. "550e8400-e29b-41d4-a716.mp4").
   * La URL final del <video src=...> la resuelve VideoStreamService: usa el SW
   * proxy si está activo (sin token en URL) o un ticket de stream de corta vida
   * como fallback. Ver initStreamUrl().
   */
  readonly fileName = input.required<string>();

  readonly idVideo = input<number>();

  /**
   * Group desde el que se está reproduciendo el vídeo. Puede ser undefined/null
   * si la reproducción ocurre fuera de un contexto de grupo (p. ej. el
   * propietario viendo su vídeo desde "Mis vídeos"). Se incluye en cada
   * heartbeat para que el backend segmente las analíticas por grupo: ver el
   * mismo vídeo desde el Group A y desde el Group B genera dos series de
   * datos independientes.
   */
  readonly grupoId = input<number | null | undefined>();

  /**
   * Emits the video's currentTime (seconds), the player-instance sessionId and
   * the optional grupoId every 5 s while playing. The parent component forwards
   * the payload to the backend heartbeat endpoint; the backend uses
   * (usuario, video, grupoId) as the upsert key, so each (group, session)
   * combination is recorded independently in the analytics panel.
   */
  @Output() heartbeat = new EventEmitter<{
    currentTime: number;
    sessionId:   string;
    grupoId:     number | null;
  }>();

  /**
   * UUID generado una sola vez por instancia del reproductor. Dos aperturas
   * distintas del <video-player> (por ejemplo: abrir, cerrar, volver a abrir)
   * producen dos sessionId diferentes, y por tanto dos filas separadas en la
   * analítica del vídeo con su propio timestamp y tiempo visto.
   */
  private readonly sessionId: string = this.generateSessionId();

  // ── Template references ─────────────────────────────────────────────────────

  @ViewChild('videoEl',         { static: true }) private videoRef!:     ElementRef<HTMLVideoElement>;
  @ViewChild('playerContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;

  // ── DI ──────────────────────────────────────────────────────────────────────

  private readonly authService        = inject(AuthService);
  private readonly videoService       = inject(VideoService);
  private readonly videoStreamService = inject(VideoStreamService);
  private readonly destroyRef         = inject(DestroyRef);

  // ── Stream URL ──────────────────────────────────────────────────────────────

  /**
   * URL que se asigna al <video src=...>. La calcula VideoStreamService:
   *   - Si el Service Worker está activo: URL same-origin /video-proxy/{file}
   *     que el SW intercepta e inyecta el JWT en cabecera Authorization.
   *     El token NUNCA aparece en la URL.
   *   - Si no hay SW: el servicio pide al backend un TICKET firmado de ~60 s
   *     atado a este fichero y lo usa como ?token=. No es el JWT principal,
   *     así que un leak está acotado a este vídeo durante el TTL.
   */
  readonly streamUrl = signal<string>('');

  // ── State signals ───────────────────────────────────────────────────────────

  readonly isPlaying    = signal(false);
  readonly isMuted      = signal(false);
  readonly volume       = signal(1);        // 0 → 1
  readonly currentTime  = signal(0);        // seconds
  readonly duration     = signal(0);        // seconds
  readonly isFullscreen = signal(false);
  readonly showControls = signal(true);

  /**
   * SCRUBBING STATE
   * isDragging: true while the user is holding the progress thumb.
   * scrubValue: the slider's value while dragging (driven by mouse, not timeupdate).
   * See onScrubStart / onScrubInput / onScrubEnd for the full explanation.
   */
  readonly isDragging = signal(false);
  readonly scrubValue = signal(0);

  /** true while the browser is stalling waiting for data (HTTP 206 buffering). */
  readonly isBuffering = signal(false);

  /** true cuando el elemento <video> dispara un evento 'error' (stream no disponible). */
  readonly videoError = signal(false);

  /**
   * Drives a brief icon-flash animation in the center of the screen
   * whenever the user toggles play/pause, giving instant tactile feedback.
   * Auto-resets after 500 ms.
   */
  readonly showClickFlash = signal(false);

  /** Position of the moving watermark overlay (percentage strings). */
  readonly watermarkPos = signal({ top: '10%', left: '5%' });

  // ── Derived / computed ──────────────────────────────────────────────────────

  /** 0-100 percentage, used to paint the filled track of the progress slider. */
  readonly progressPercent = computed(() =>
    this.duration() > 0 ? (this.currentTime() / this.duration()) * 100 : 0
  );

  /**
   * The identifier shown in the watermark.
   * We decode the JWT payload (no library needed — it is just base64) to read
   * the `sub` claim, which Spring Boot sets to the user's email address.
   * Falls back to the stored username if decoding fails for any reason.
   */
  readonly userIdentifier: string;

  // ── Private ──────────────────────────────────────────────────────────────────

  private hideControlsTimer: ReturnType<typeof setTimeout> | null = null;
  private clickFlashTimer:  ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

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

  // ── Private init helpers ────────────────────────────────────────────────────

  /**
   * Pulso de telemetría reactivo gobernado por eventos DOM del <video>:
   *   play  → arranca un timer(0, 5_000) que emite al padre.
   *   pause / ended → switchMap corta el timer, así no seguimos "ping-eando"
   *     al servidor mientras el vídeo está parado.
   * El throttle natural del timer (5 s) garantiza como máximo 1 HTTP/5 s.
   * timer(0, 5_000) dispara inmediatamente al hacer play para capturar
   * sesiones muy cortas, y luego cada 5 s.
   * takeUntilDestroyed se encarga de cerrar todo al destruir el componente.
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

  /**
   * Produce un UUID v4. Usa crypto.randomUUID cuando está disponible (Chrome 92+,
   * Firefox 95+, Safari 15.4+); si no — p. ej. contextos HTTP antiguos —, genera
   * un UUID compatible a partir de crypto.getRandomValues. Solo se necesita
   * unicidad práctica: colisiones entre sesiones del mismo usuario/vídeo son
   * astronómicamente improbables en ambos caminos.
   */
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

  /**
   * Moves the watermark to a random position every 10 s.
   * timer(0, 10_000) fires immediately (0 ms delay) then every 10 s.
   */
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

  /** Keeps isFullscreen in sync with the native fullscreenchange DOM event. */
  private initFullscreenListener(): void {
    fromEvent(document, 'fullscreenchange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.isFullscreen.set(!!document.fullscreenElement));
  }

  /**
   * Decodes the JWT payload with a plain atob() call (no external library).
   * Spring Boot sets the `sub` claim to the authenticated user's email,
   * so this gives us the real email for the watermark without an extra API call.
   */
  private resolveUserIdentifier(): string {
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub) return payload.sub;
      } catch { /* fall through to username */ }
    }
    return this.authService.getUser()?.username ?? 'Lockstrm';
  }

  // ── Video event handlers ────────────────────────────────────────────────────

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
   * SCRUBBING — KEY GUARD:
   *
   * timeupdate fires ~4×/second during playback and would continuously push
   * a new value into the currentTime signal, which drives the slider's [value].
   * Without the isDragging guard, that signal update would fight the user's
   * mouse position and the thumb would jitter or snap back during a drag.
   *
   * Guard: while isDragging() is true, timeupdate is ignored. The slider
   * is instead driven exclusively by scrubValue(), which is written in
   * onScrubInput(). The two update paths are mutually exclusive.
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

  /** Fired by the <video> 'waiting' event — browser is stalling for data. */
  onWaiting(): void {
    this.isBuffering.set(true);
  }

  /** Fired by the <video> 'canplay' event — enough data to resume. */
  onCanPlay(): void {
    this.isBuffering.set(false);
  }

  /** Fired by the <video> 'error' event — stream 404, token expirado, red caída. */
  onVideoError(): void {
    this.isBuffering.set(false);
    this.isPlaying.set(false);
    this.videoError.set(true);
  }

  // ── Playback controls ───────────────────────────────────────────────────────

  togglePlay(): void {
    const video = this.videoRef.nativeElement;
    if (video.paused) {
      video.play();
      this.isPlaying.set(true);
    } else {
      video.pause();
      this.isPlaying.set(false);
    }
    this.triggerClickFlash();
  }

  /**
   * Shows the center flash icon for 500 ms.
   * By the time the template reads isPlaying() inside the flash div,
   * the signal already holds the new state — so the icon always matches
   * the action the user just took (play → play icon, pause → pause icon).
   */
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

  // ── Scrubbing (progress bar) ────────────────────────────────────────────────

  /**
   * Step 1 — User presses down on the progress thumb.
   * We raise the isDragging flag so onTimeUpdate() stops overwriting the slider.
   * We also seed scrubValue with the current position so the thumb does not jump.
   */
  onScrubStart(): void {
    this.isDragging.set(true);
    this.scrubValue.set(this.currentTime());
  }

  /**
   * Step 2 — User moves the thumb (fires continuously while dragging).
   * We update scrubValue (which drives [value] in the template while isDragging)
   * AND seek the video immediately so the user gets a live preview.
   * timeupdate fires here too, but isDragging() blocks it from touching the slider.
   */
  onScrubInput(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.scrubValue.set(value);
    this.videoRef.nativeElement.currentTime = value;
  }

  /**
   * Step 3 — User releases the thumb (mouseup / touchend).
   * We perform the final seek, lower isDragging, and resync currentTime so the
   * very next timeupdate does not produce a visible jump.
   */
  onScrubEnd(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.videoRef.nativeElement.currentTime = value;
    this.currentTime.set(value);
    this.isDragging.set(false);
  }

  // ── Fullscreen ──────────────────────────────────────────────────────────────

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.containerRef.nativeElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // ── Controls visibility ─────────────────────────────────────────────────────

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

  // ── Security ────────────────────────────────────────────────────────────────

  /** Blocks the browser's native "Save video as…" context menu. */
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

}
