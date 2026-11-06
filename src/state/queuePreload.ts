/** Retains only the queue head. Decode requests are serial and obsolete heads are skipped. */
export class QueuePreload<T extends { id: string }, B> {
  id?: string;
  track?: T;
  buffer?: B;
  loading = false;
  error?: unknown;
  private version = 0;
  private pending: Promise<void> = Promise.resolve();
  select(id: string, track: T, load: (track: T) => Promise<B>): Promise<void> {
    if (this.id === id) return this.pending;
    const version = ++this.version;
    const reusable = this.track?.id === track.id ? this.buffer : undefined;
    this.id = id;
    this.track = track;
    this.buffer = reusable;
    this.error = undefined;
    this.loading = !reusable;
    this.pending = this.pending.then(async () => {
      if (version !== this.version || reusable) return;
      try {
        const buffer = await load(track);
        if (version === this.version) this.buffer = buffer;
      } catch (error) {
        if (version === this.version) this.error = error;
      } finally {
        if (version === this.version) this.loading = false;
      }
    });
    return this.pending;
  }
  clear() {
    this.version++;
    this.id = undefined;
    this.track = undefined;
    this.buffer = undefined;
    this.loading = false;
    this.error = undefined;
  }
}
