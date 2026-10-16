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

## Particle sphere refinement

The orb is now an original 260-dot Fibonacci sphere rendered as a static SVG. Depth controls dot size and opacity in restrained teal/slate colors. Only the existing measured audio amplitude scales the container; no idle motion or new animation loop, capture, dependency, or 3D engine was added. Existing reduced-motion and lifecycle safeguards remain intact. Mobile and desktop browser checks passed with real synthetic audio and mocked WebRTC/auth/backend. Full suite: 208 tests passed; production build passed with the existing bundle-size warning.

Screenshots: mobile `libfile_c5ea90cf919481918d8311ee841f99fb`; desktop `libfile_703118df99108191870369d90e64b152`.

## Gradient refinement (not deployed)

General visual reference: [VoiceOrbs Particles Orb](https://github.com/amunozdev/voiceorbs), whose repository identifies an MIT license. No repository code, scripts, assets or dependencies were imported. Our existing original SVG now interpolates cyan/blue through violet to pink by particle position. Depth increases foreground dot size, opacity and color strength; three faint CSS radial gradients supply a restrained glow. The 260 static dots and existing audio-only container transform remain; no extra animation loop or audio lifecycle changes.

Verified the actual app at 390px and 1440px with `browser-voice-orb.mjs`: no horizontal overflow, real synthetic audio amplitude response, explicit microphone capture, mute/end/unmount cleanup and reduced motion all pass. Auth, WebRTC and backend are mocked. Four voice-meter unit tests, build and diff check pass; the existing bundle-size warning remains. Both screenshots visually inspected.

New screenshot Library IDs: mobile `libfile_3331e9abb0808191807290010cabdb35`; desktop `libfile_ab78fd778ebc8191b7460238bdb63d8c`. This visual follow-up preserves the preceding source-identity fix. Neither follow-up is deployed; production remains `d196e83`.

## Selected design A — glass/light sphere (not deployed)

Inspected the directly attached concept board, left panel A. Replaced the particle/rainbow rendering with an original CSS blue-white sphere: layered smooth gradients, broad frosted highlights, a thin cyan rim, and a soft halo. Uses one decorative span with pseudo-elements; no images, third-party dependencies, canvas or new animation loop. Existing amplitude-driven container scaling and all state/accessibility/audio lifecycle logic remain unchanged.

Actual application screenshots at 390px and 1440px were visually inspected with no horizontal page overflow. Browser voice checks pass for real synthetic microphone/playback amplitude, intentional capture, mute/unmute, end/unmount cleanup, state labels and reduced motion. Auth, WebRTC and backend remain mocked; this is not live voice-service verification. Eleven focused voice-meter and food-guide tests pass, including the preserved source-identity regressions. Build and diff checks pass; existing bundle-size warning remains.

Library screenshots: mobile `libfile_2e9418be9ae88191938228789a263b8f`; desktop `libfile_2213662340508191bad0e5770cdfd45c`. Prior commits including `82cf5fb` and `6898332` remain in history. No deployment or push performed.
