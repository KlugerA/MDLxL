# MDLxL 0.13.0 — September 28 updates

Published September 29, 2026, including the September 28 workday and overnight continuation. This list includes work already merged earlier that day.

## Showcase (PRs #33, #38, #39)
- GIF recording with model-centered Z orbit, direction, speed, radius, full-circle timing, centering, maximal zoom, model alignment and Shift axis locking.
- Crop presets and selection; correct aspect ratio through preview, capture and export; separate Hive Main Picture output.
- Portrait cameras, framed or frameless black portraits; backgrounds, silent video sections, saved color swatches and per-recording lighting.
- Multiple image/GIF signatures; styled animated text, fantasy/science-fiction fonts, selected-text formatting, direct rotation, alignment/grid and fade controls.
- Saved/loaded layouts and five starter presets; editable recording lists that restore the assigned model, textures, settings and lighting for each take.
- Separate orbit and full-recording animation previews, collapsible sections, arbitrary animation loop counts and Extra Time with displayed duration.
- Independent continuous global sequences; animation-specific emitter timing and per-emitter controls.
- Background GIF encoding, bounded-memory large GIF handling and export size budgets.
- Optional Hive export profile; deselect it for original-quality local GIFs.
- Showcase-only model loading, keeping editor models separate and preserving matching animation/settings across model changes.

## OptimizeXL (PRs #36, #41)
- Staged model review, original/corrected comparisons and Optimize New Copy workflow.
- Model cleanup, track and motion review, geoset exclusions, candidate previews and verified correction boundaries.
- Latest opening/unused track findings, attached glow visibility leak detection, and Footman sphere handling.
- Reusable teaching/regression rules; supplied reference models remain test evidence rather than runtime repair templates.

## Animation and UV
- Create from current animation (PR #37).
- UV wrapper remains in textured view; surface-view switching cannot displace it. Existing F texture/wireframe behavior is retained.

## Toolbar (PRs #40, #42)
- Larger editor tabs and reorganized module buttons.
- Matching VIS/XL icon frames, transparent label backgrounds, and no extra XL badge on OptimizeXL.

## Distribution
- Combined source and rebuilt renderer published through a release PR.
- Windows portable ZIP includes the full runtime and required component notices, excluding personal profiles and recordings.
- Offline installation updated from the same package while retaining personal data.

Earlier material presets, UV selection, portrait compatibility, model-preservation and startup fixes remain included from prior releases.
