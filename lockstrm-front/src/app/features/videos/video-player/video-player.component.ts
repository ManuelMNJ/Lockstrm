import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, interval, timer } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { VideoService } from '../../../core/services/video.service';
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

  /** Streaming URL already containing the JWT token as a query param. */
  @Input({ required: true }) videoUrl!: string;

  @Input() idVideo?: number;

  /**
   * Emits the video's currentTime (seconds) every 30 s while playing.
   * The parent component is responsible for sending this to the backend.
   */
  @Output() heartbeat = new EventEmitter<number>();

  // ── Template references ─────────────────────────────────────────────────────

  @ViewChild('videoEl',        { static: true }) private videoRef!:     ElementRef<HTMLVideoElement>;
  @ViewChild('playerContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;

  // ── DI ──────────────────────────────────────────────────────────────────────

  private readonly authService  = inject(AuthService);
  private readonly videoService = inject(VideoService);
  private readonly destroyRef   = inject(DestroyRef);

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
      this.videoRef?.nativeElement?.pause();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    });
  }

  ngOnInit(): void {
    this.initHeartbeat();
    this.initWatermark();
    this.initFullscreenListener();
    if (this.idVideo != null) {
      this.videoService.registrarVista(this.idVideo)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => {} });
    }
  }

  // ── Private init helpers ────────────────────────────────────────────────────

  /**
   * Emits a heartbeat every 30 s, but ONLY while the video is playing.
   * takeUntilDestroyed unsubscribes automatically when the component is destroyed.
   */
  private initHeartbeat(): void {
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isPlaying()) {
          this.heartbeat.emit(this.currentTime());
        }
      });
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
    this.duration.set(this.videoRef.nativeElement.duration);
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
    // Only auto-hide while the video is actually playing.
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
