/** Declare music playback before context creation/resume on supporting WebKit.
 * Optional API: unsupported browsers retain their existing audio path.
 */
export function configurePlaybackSession() {
  if (typeof navigator === 'undefined') return;
  try {
    const session = (navigator as Navigator & {
      audioSession?: { type: string };
    }).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch {
    // An embedded browser may expose but reject the experimental API.
    // Do not prevent the standard user-gesture AudioContext.resume path.
  }
}
