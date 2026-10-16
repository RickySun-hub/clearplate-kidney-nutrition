# Minimal voice orb

Original CSS orb replaces the live waveform and the recipe-recording composer. It uses no copied branded assets. Conversation modes move into an optional disclosure; text entry, transcripts, recipe tools, and nutrition confirmation remain intact.

## Genuine signals and limits

- Idle: no active call/capture. No amplitude animation.
- Connecting: user-initiated microphone/session setup. Availability checking has its own label and does not request the microphone.
- Listening: established live session or active local recording; this means ready to receive speech, not proof that a particular word was recognized.
- Processing: received transcript/tool activity, recorded request processing, or graceful session close. The integration does not expose an authoritative server “thinking” signal.
- Speaking: remote playback amplitude over a small threshold, or actual greeting/browser speech playback events. Browser speech synthesis has no accessible audio stream here, so its orb remains static. Greeting amplitude is available only where `captureStream()` supplies usable audio tracks.
- Muted: existing microphone tracks are disabled; no replacement microphone is opened. Remote playback can still show “Speaking · mic muted”. Recording pause also disables its microphone track.
- Error: denied permission, connection failure, or voice unavailable; text/manual confirmation remains available.

Existing owned microphone and remote MediaStreams feed Web Audio time-domain RMS analysers. A noise floor, bounded 1–1.18 scale, and attack/release smoothing keep changes subtle. No oscillation, fake level, or idle pulse is generated. Missing/suspended analysers yield no movement. Reduced-motion users get a static orb while state labels continue to update.

Meter ownership is separate from capture ownership: meters disconnect sources/analysers, cancel animation frames, and close AudioContexts; they never request or stop microphone tracks themselves. The existing call/recording owners stop tracks on end/unmount. Live auto-start was removed, including mode-selection auto-start; only the microphone button starts capture. A request lock prevents duplicate local recording starts, and ending a pending capture rejects its eventual stream.

## Verification

- 25 focused tests passed: audio RMS/smoothing bounds, state mapping, idempotent cleanup, missing-stream behavior, existing transcript and meal-tool handling, voice server contract.
- Production build passed with the existing bundle-size warning.
- `CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-voice-orb.mjs`: actual app UI, mocked auth/WebRTC/backend, **real oscillator-generated synthetic MediaStreams**, plus a silent synthetic WAV greeting. No real microphone, live AI inference, or patient data used.
- Browser assertions: no capture on open/mode selection, exactly one mic request before mute/unmute, amplitude changes, listening/muted/processing/speaking/error states, reduced motion, stopped tracks, closed meter contexts, cancelled animation frames, active-session unmount, and preserved typed unknown-nutrition confirmation.
- Screenshots at 390 px and 1440 px; no horizontal page overflow or browser exceptions. Mobile inspected for orb framing, readable state, accessible microphone/end buttons, and flat layout. Screenshot motion is driven by synthetic microphone audio; a static PNG cannot demonstrate the animation.

No credentials, backend settings, database/security changes, merge or deployment.
