# V1 regression checklist

## Automated and browser evidence (2026-09-29)

- `node tests/audio.mjs`: editor constraints, recommendation validation, Same/Matched data, legacy/V1 phases, clamped/snap PRE, countdown boundaries passed.
- `backend/.venv/bin/python -m pytest backend/tests -q`: 4 API/ranking tests passed (duration cache, hash cache, busy/error/manual fallback).
- `/tests/audio.html`: 16 actual OfflineAudioContext V0 checks passed.
- `/tests/editor.html`: 8 actual OfflineAudioContext editor checks passed.
- `/tests/v1.html`: 48 checks passed, including same/matched full A/B audio samples, B PRE, continued judging samples at 30%, duplicate START, 30 repeated schedule/stop cleanups.
- Real 186s song analyzed using full All-In-One ensemble (v2), returned BPM/beats/downbeats/9 sections/3 suggestions/3 pairs. Cached result used by editor.
- 390px iframe layout: editor and Live document width equals scroll width; mobile screenshots checked. Separate desktop Chrome connector unavailable.
- Browser: Apply single, manual override, Apply Pair, independently change B, matched Save/reload, played-track reselection, PRE A → Judging → END verified in Chromium.

## Manual listening / device checklist

Use a real song with at least 10s remaining after B; repeat with no analysis and after Analyze Track.

- [ ] On physical iPhone Safari and Android: import file, drag playhead/handles, Focus, tap play/pause without accidental drag.
- [ ] A completes the selected duration; transition has no audible click/pop with actual speaker output.
- [ ] PRE B plays the correct preceding music, then the exact B range (Same or Matched).
- [ ] Countdown stays synchronized through suspend/resume, app switching and long sessions.
- [ ] Judging continues past B end, volume fades to 30%, no countdown.
- [ ] END fades, returns to New Round, played track remains selectable.
- [ ] Run a long real-device session, observe memory/thermal behavior and transitions with diverse music.

Offline rendering verifies scheduling/sample behavior, not perceived mix quality. Simulated viewport and Chromium are not physical Mobile Safari validation. iOS Simulator control timed out in this environment.
