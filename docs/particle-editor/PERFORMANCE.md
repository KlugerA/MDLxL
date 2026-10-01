# Particle prototype performance fixture

Defined 2026-09-30 before measurements, after the initial implementation. This does not meet the contract's requested pre-implementation fixture definition; the historical source snapshot provides a retrospective baseline.

Reference hardware: AMD Ryzen 7 5700X (8 cores, 16 threads), NVIDIA GeForce RTX 5060 Ti, driver 32.0.16.1062, 34,281,119,744 bytes system RAM, Windows. Electron 40; hardware WebGL renderer string recorded by the test.

The isolated harness renders the same 919 x 584 CSS-pixel viewport (pixel-ratio preference 1.5; antialias off uses the device ratio, measured drawing buffer 919 x 584), camera and 60 FPS target with the original 64 x 64 soft-disc picture. Representative fixture: four PE2 emitters, 100 particles/s each, 2 s lifespan, approximately 800 steady-state live particles, 5 s looping clip. Heavy fixture: 32 emitters, 400 particles/s each, 2 s lifespan, approximately 25,600 steady-state particles; the authoring limit is 12,000 and must be reported without changing values.

Baseline: archived source c62faa4299a0b44519f992cf3765da7623e72417 using its original GamePreview/native playback. Current: ParticleAuthoringPreview in the same harness. Warm up for 3 s and sample native render submissions for 5 s. Report actual intervals, FPS, particle counts and errors; draw submission is not physical screen scanout.

Latency: while paused at 1,000 ms, move actual pointer input through Size and Speed sliders. Timestamp the input event and the first subsequent native draw with the matching appearance or reconstructed particle velocities. One outstanding input is measured at a time; a separate continuous drag checks coalescing and convergence. Report p50/p95/max, sample count and timeouts. The harness includes the actual gesture adapter and preview but omits the surrounding editor/library layout; whole-application user latency remains a separate evidence boundary.

Results will be written to out/particle-prototype/performance.json and summarized here after execution.

## Measured result

The archived baseline produced 50.00 FPS (251 draws; p95 interval 20.2 ms). Current authoring produced 50.00 FPS (251 draws; p95 interval 22.2 ms), with about 796–800 live particles. The requested 60 FPS target was not reached by either path under this desktop scheduling/display environment; the baseline above 30 FPS was maintained. ANGLE used the RTX 5060 Ti Direct3D11 backend.

Input-to-native-draw: Size, 26 samples, p50 15.5 ms / p95 15.7 ms / max 15.7 ms. Speed, 25 samples, p50 52.7 ms / p95 57.5 ms / max 57.6 ms. Both measured p95 values are within 100 ms. These are the controlled gesture/renderer harness measurements, not OS scanout or user acceptance. The run found and corrected a real focus/blur transaction race when moving directly between sliders.

The heavy fixture reached the visible 12,000-particle authoring budget during initial reconstruction and stopped with its message. Its authored emission rate remained 400 for all 32 emitters. It did not establish a completed valid FX frame, so no heavy-fixture FPS is reported. No values were silently lowered.

Evidence: test/particle-performance.electron.cjs and out/particle-prototype/performance.json. The baseline source archive is local and must be recreated from c62faa4299a0b44519f992cf3765da7623e72417 when rerunning on another checkout.

## Checkpoint 6 repeat

After preserving native particles across full-clip loops, the same isolated fixture produced baseline 50.00 FPS (250 draws, p95 interval 20.3 ms) and current 50.00 FPS (251 draws, p95 interval 21.3 ms). Current local/global times diverged correctly after a loop (approximately 4035/9035 ms); live count remained 796.

Size: 26 samples, p50 15.6 / p95 15.8 / max 15.8 ms. Speed: 25 samples, p50 52.2 / p95 53.3 / max 53.4 ms. Heavy fixture again stopped during reconstruction at the explicit budget with emission rate 400 unchanged, so no heavy FPS is claimed. The original environment and measurement limits above still apply.
