# MDLxL 0.14.0

- Edit RGB and visibility keys directly while a global sequence is selected. Tracks owned by another timeline remain protected instead of being silently reassigned.
- Add Highlight Chain, Focused Skeleton, 1–250% playback speed, and compact collapsible Movement and Animations sections.
- Show the Bones object-picker labels instead of hiding the native dropdown text.
- Close known-clean saved models without a discard prompt. Changed or never-saved models offer Save, Cancel, and Close, and Save completes before exit.
- Keep UV work focused by limiting normal zoom-out to a 7×7 texture-tile view. A persisted `View 7×7` control beside Disable Wrapping lets the user raise that limit when a model genuinely needs more space.
- Show the first Texture Library page before complete search indexing finishes.

The unfinished geoset-density slider is not included in this release.

## Validation

The 56 compatibility checks pass. Focused source checks cover UV limit normalization and zoom bounds, saved-model close decisions, Bones labels, movement hierarchy and playback controls, display overlays, and global-sequence RGB/visibility ownership. Rebuilt Electron checks pass for the UV control and wrapping workflow, unchanged model bytes, visible Bones labels, saved and never-saved close behavior, Highlight Chain, Focused Skeleton, playback speed, and collapsible sidebars.

Two existing historical source assertions remain separate from this release: the animation text parser accepts a negative frame that its older test still expects to reject, and the server-rendered inline RGB test expects a value populated by a client-side effect. Both reproduce on the previous checkout.

Extract the complete Windows ZIP to run the release. Preserve your existing `resources/app/profile` and personal Addons, Backgrounds, BitsAndParts and Showcase Recordings when replacing a portable installation.
