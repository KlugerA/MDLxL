# Particle Editor prototype acceptance evidence

Checkpoint 7, 30 September 2026. This is an isolated working prototype, not full contract acceptance or a release. Automated Electron captures are offscreen and do not establish user visual acceptance. No Warcraft runtime test has been performed.

Evidence commands: the focused native tests in test/particle-{prototype,preview,sweep,library}.test.js, test/desktop-settings.test.js and tests/*.test.js (115 passing); production Vite build; test/particle-prototype.electron.cjs; test/particle-model-io.electron.cjs; test/particle-review.electron.cjs; test/particle-performance.electron.cjs. Runtime harnesses use private profiles. Logs and captures are local ignored output; no Warcraft asset bytes are committed.

| Gate | Demonstrated evidence | Remaining boundary |
|---|---|---|
| A01 | No-model restart recovers an editable starter; personal preset save/reopen and custom picture bytes pass. | User-visible acceptance pending. |
| A02 | CASC working-copy edits, browsing and source-context viewing leave the source recipe and target canonically unchanged. | Broad source corpus not certified. |
| A03 | Mode switches retain canonical values; native fixtures cover typed arrays, unusual values, flags, spline tangents, globals and UV groups. | Broader imported-file matrix remains useful. |
| A04 | Actual 1400x920 and 960x720 layouts meet the two-thirds stage and six-primary-control limits. | Other DPI/screen sizes not measured. |
| A05 | Real pointer/slider updates, one undo, Escape and cross-control focus ordering pass; measured input-to-draw is below 100 ms. | OS scanout latency not measured. |
| A06 | Real pinned particle resize survives more than two seconds and the sampled particle's death; only selected native size changes. | Broader moving-parent visual fixtures pending. |
| A07 | Spawn/aim/spread guides and independent fields are implemented, with bounded projection and zero-size proxies. | Complete transformed-parent/axis/broad-angle visual matrix pending. |
| A08 | Pointer mapping is latched; animation is not input; parent data is not edited by the gesture adapter. | Animated-parent stationary-pointer runtime proof pending. |
| A09 | Actual three life samples, size/color/opacity editing, invisible proxies and Time 0/1 pass. | Additional unusual imported endpoint visuals pending. |
| A10 | Key time/global phase/scope latch at gesture start; spline tangent/whole-track semantics tested; no continuous key creation. | Complete animated-field UI matrix pending. |
| A11 | Fixed-grid native simulations produce exact particle-state equality at matching clocks across display partitions. | Real Warcraft matching is unverified. |
| A12 | Independent clocks, FX pause/resume, visible unlinked state and coherent relink pass without canonical mutations. | Inspection timing is deliberately not exported. |
| A13 | Backward replay, narrow one-millisecond windows, exact Squirt/global events, full-loop survivors and endpoint seeking pass. | Broader real source lifecycle fixtures pending. |
| A14 | Native ribbon edge handles/window/path selection and demonstration isolation pass; paired PE2/ribbon motion example renders. | Real source weapon/lifecycle matrix and ribbon gravity parity incomplete. |
| A15 | Actual main-view double-click opens an existing emitter; overlap cycling and invisible list access pass. | Alpha-tested model-surface occlusion still needs work. |
| A16 | Actual ghost drag, pivot/surface snap, cancel, one-step confirm, exact undo/redo pass. | Target without an animation clip is not supported by placement yet. |
| A17 | Sparse object/resource/global remapping, minimal ancestors and source/target motion choices tested without unrelated mutations. | Nonuniform-parent visual matrix and arbitrary spline boundary fitting need more proof; BPOS graphs are explicitly blocked. |
| A18 | Actual MDL/MDX Save As and reopen of mixed stock/custom PE2+ribbon passes; output equals codec expectation, custom sidecar retained, original input untouched. | Does not certify every indexed effect or Warcraft rendering. |
| A19 | Source groups retain their native ingredients; PE1/Popcorn/missing dependencies remain visible as incomplete. | PE1 simulation/insertion and other discovered exceptions prevent full classic support. |
| A20 | Build-bound actual CASC inventory accounts for 3,486 candidates, 3,485 parsed, 4,581 recipes and 437 unavailable identities; coverage dimensions are separate. | Preview/insertion compatibility counts remain uncertified, not inferred from extraction. |
| A21 | Personal naming/tags/favorite/duplicate/import/export and native-close/restart persistence exercised; custom bytes and independent documents retained. | Broader stale-dependency thumbnail matrix pending. |
| A22 | Source/build/hash/namespace verification, missing assets and no-install starters have distinct paths and tests. | Full UI changed-build/missing-install matrix not exercised. |
| A23 | Unsafe keys, traversal, oversized/count/depth/nonfinite/typed overflow and malformed recipes rejected; atomic recoverable saves tested. | No independent security audit claim. |
| A24 | Controlled retrospective baseline/current fixture: both 50 FPS, Size p95 15.8 ms, Speed p95 53.3 ms; heavy preview stops visibly at 12,000 without authored clamps. | 60 FPS not achieved; baseline was reconstructed afterward. See PERFORMANCE.md. |
| A25 | Actual read-only model blocks authoring/insertion/keyboard undo; Lab remains editable; draft flush before debounce and no-model recovery pass. | Full accessibility audit not performed. |
| A26 | Not run. | Warcraft build/assets/test sequence and observed game results remain required. |
| A27 | Effect-first gallery, appearance categories/search, active isolated thumbnails, selected playback and explicit source context work in both modes. | Most neutral catalog entries still lack reviewed useful names. |
| A28 | Real configured CASC extraction, cached restart, corrupt-file continuation and cancel/resume from 25 to 50 unique assets demonstrated. | Full scan timing/resume stress matrix not measured. |
| A29 | 31 observed effect names are content-hash bound; exact duplicate associations and name/tag override persistence tested. | 4,987 catalog identities remain review-needed; an ambiguous blank ribbon was deliberately not named. |

Additional contract evidence: five original paired examples share camera/seed/time/global phase; a disposable test view supports repeated instances, viewing distance, backgrounds and team colors. Source contexts, examples and test views leave both documents unchanged.

The historical full source suite had 17 failures and two skips out of 1,067 tests. Sixteen assertion failures were reproduced on the untouched base; one CPU-bound keyframe test was stopped. The current focused/compatibility pass is not a claim that the whole historical suite is green. See PROGRESS.md for the exact work and evidence sequence.
