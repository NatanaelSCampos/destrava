export class HtmlMediaPresentationController {
  constructor(private readonly element: HTMLMediaElement) {}
  load(src: string) {
    if (this.element.getAttribute("src") !== src) {
      this.element.src = src;
      this.element.load();
    }
  }
  play() { return this.element.play(); }
  pause() { this.element.pause(); }
  seek(ms: number) { this.element.currentTime = Math.max(0, ms) / 1000; }
  setPlaybackRate(rate: number) { this.element.playbackRate = rate; }
  get currentTimeMs() { return Math.round(this.element.currentTime * 1000); }
  get durationMs() { return Number.isFinite(this.element.duration) ? Math.round(this.element.duration * 1000) : 0; }
}
