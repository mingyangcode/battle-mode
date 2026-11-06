/** One retained next buffer; stale completions never replace the latest selection. */
export class NextTrackSlot<T extends { id: string }, B> {
  track?: T;
  buffer?: B;
  loading = false;
  error?: unknown;
  private version = 0;
  async select(track: T, load: (t: T) => Promise<B>) {
    const version = ++this.version;
    this.track = track;
    this.buffer = undefined;
    this.error = undefined;
    this.loading = true;
    try {
      const buffer = await load(track);
      if (version === this.version) this.buffer = buffer;
    } catch (e) {
      if (version === this.version) this.error = e;
    } finally {
      if (version === this.version) this.loading = false;
    }
  }
  clear() {
    this.version++;
    this.track = undefined;
    this.buffer = undefined;
    this.error = undefined;
    this.loading = false;
  }
}
