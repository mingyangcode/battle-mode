# V1.1 regression — 2026-09-30

## Verified

- Pure logic: legacy timing, Same/Matched pre-roll, equal durations, beat fallback, audio-clock countdown, Continue derivation/clamps/insufficient tail/duration changes/default migration, delete/undo ordering and thresholds, Judging wrap.
- Browser real OfflineAudioContext: `/tests/audio.html` 16 assertions; `/tests/editor.html` 8; `/tests/v1.html` 48 (includes 30 repeat-round cleanup checks); `/tests/v11.html` 17 (scratch boundary/headroom, four consecutive gap-free constant-signal Judging seams, END cancellation, Continue continuous source/no cue).
- `/tests/storage.html`: 6 IndexedDB assertions, including Blob deletion/restore, idempotent Played and no resurrection of a deleted live track.
- Backend: 11 pytest tests including profiling, Quick/Deep, failure preserving Quick, raw reuse, mode/duration reranking, Continue tail constraint and cache-only editor lookup.
- 390px iframe: no horizontal overflow; Continue A clamps at maximum; insufficient duration disables save; derived B/post changes; saved Continue runs through WRAP UP and Judging, ends, becomes Played and is selectable again.
- Pointer mouse gestures at mobile width: partial swipe leaves red Delete exposed; click+UNDO restores; full swipe directly removes disposable fixture. Vertical wheel scrolling works. Physical touch remains a device acceptance item.
- Real Editor with mocked transport (`/tests/analysis-ui.html`): Quick Apply then manual 7–9s remains 7–9s when Deep recommends 12–14s; AI unavailable still permits manual 8–10s save. Mock timing is fixture-only, not performance evidence. Fixture cleaned.
- Real 186.09s song before/after profile and cache reranks: see `backend/profiles` and `PROJECT_STATE.md`.

## Remaining human/device acceptance

- Audition original 350ms synthetic scratch on real music through event speakers/headphones. Render tests establish scheduling/peak safety, not subjective musical quality.
- Physical iPhone Safari and Android touch, lock screen/background interruption, Bluetooth/external speaker latency.
- Long suspended/background sessions can exceed the four-song scheduled loop horizon; browser suspension requires user resume. No claim of unrestricted background audio.
- MPS candidate crashed (exit 139), so CPU remains selected. MLX was not installed or benchmarked.

## Running

Start frontend and `backend/run.sh`; open each test HTML. UI fixture pages create disposable records only and expose cleanup buttons. Product code never uses fixture responses. No test code is included in the production entry bundle.
