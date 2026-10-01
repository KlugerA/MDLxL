# MDLxL 0.15.2

This patch keeps Texture Library searches responsive and adds an explicit through-model selection option.

- Texture name and path matches now appear immediately from the loaded catalog while Vibe search finishes indexing in the background.
- Full Vibe results still replace the immediate literal matches when they are ready.
- Clearing a search or disabling Vibe search prevents a late background result from reappearing.
- Vertices and Bones now include a Grabthrough checkbox.
- Grabthrough defaults off, so Textured View selects only surface-visible vertices. Turn it on to restore through-model selection.
- Movement remains unchanged and does not show the Grabthrough control.

MDLxL 0.15.2 includes every change released in 0.15.1.
