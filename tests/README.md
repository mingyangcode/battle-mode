Audio regression: start Vite and open /tests/audio.html. This exercises the actual OfflineAudioContext rendering graph, not a mocked HTML audio player. A failed assertion is displayed with a stack trace.

/spike (or ?spike) is the minimal real-time test: generated 32-second full track, segment 6–10 seconds, 5-second pre-roll. Expect PRE for 5s, A for 4s, B for 4s (including the crossfade), then JUDGING with the playhead beyond 10s. END fades over 500ms.
