# V1 Phase 1 — verification and manual QA

Scope: editor only. B Pre-roll, AI, matched segments and Live countdown are not part of this phase.

## Automated checks

- `npm test`: V0 schedule/curves plus locked-window movement, both boundary clamps, invalid duration, legacy free editing, preview ranges, Focus bounds and pixel-to-time mapping. Fixed-length movement is checked across thousands of start/end positions.
- Development URL `/tests/audio.html`: 16 actual OfflineAudioContext assertions for V0.
- Development URL `/tests/editor.html`: 8 actual OfflineAudioContext assertions for editor range seek/stop, position clamp, pause/fade, pending resume cancellation and song-end rejection.
- `npm run build`: TypeScript and production build.

## Verified in desktop Chromium / mobile viewport

- Legacy prepared songs open without migration; manual editing remains available.
- 40-second lock and 80–120s selection show a 70–130s Focus viewport on a real 212-second track.
- A 40-second duration on a 32-second test track shows an inline error and disables Save.
- With duration 4s, moving Start to 31s clamps to 28–32; moving End to 1s clamps to 0–4.
- Test segment 2–6s: Start Preview starts at 0 and ends at 7; End Preview starts at 1 and ends at 11. Playhead stops exactly at each endpoint.
- Tapping the playhead starts playback. Dragging during playback pauses and leaves the selected 6.1s position stable.
- In Focus, dragging End from 6s to 9.1s also moves Start from 2s to 5.1s, retaining exactly 4s. Focus reframes on release.
- Saving the 2–6s/4s lock and reloading restores the duration metadata.
- Saved test track runs through V0 PRE → A → B → Judging. Judging playhead reaches 15.9s beyond segment end; END returns to selection; Played remains directly selectable.

## User / physical-device QA — pending

- [ ] iPhone Safari: tap versus tiny pointer movement, long hold, drag while playing, pointer cancel, scroll near handle.
- [ ] Android: same gesture tests; rotate screen and check controls.
- [ ] Headphones/speaker: Start/End Preview timing; pause and fast preview switching without objectionable artifacts.
- [ ] Lock 40 seconds on a long song; drag both boundaries to both ends; clear field to unlock; save/reopen.
- [ ] Compare Focus and Full Track; verify same segment timestamps and smooth editing.
- [ ] Background/foreground or interruption: audio recovery control and stable playhead.
- [ ] Run several Live Rounds: both dancers receive the same full segment, B continues original audio into Judging, gain duck and END fade sound correct, Played count updates once.

Physical device tests and subjective listening are not claimed as completed. V0 A→B intentionally has no B PRE in this phase.
