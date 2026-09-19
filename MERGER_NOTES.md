# Movement Recomp — required merger notes

These Movement-lane corrections are part of the final product and must travel with the lane when it is merged:

- Keep the language selector at the far right of the merged toolbar. Its popup is right-aligned to the selector and at least 220 px wide so every language name, including “The Language of Mordor”, remains on-screen and uncut.
- Keep the former Display toolbar row removed. Bones, Wireframe Overlay, Nodes, Attachments, Emitters, Vertices, Grid, Cameras, Normals, Show Particles, and Clean View now live in the top-level View menu and retain checked state.
- In Movement/Bones, do not restore the UV-maps toolbox button. UV-maps belongs only to the Vertices toolbox.
- The Movement/Bones toolbox ends with “List of bones connected to selected vertices” and a larger list field. Clicking a listed bone changes the current bone/node selection without clearing the selected vertices.
- Workplane coordinate locks are intentional and required: XY disables Z, ZX disables Y, and YZ disables X. The disabled field must stay visibly grey and uneditable.

Primary files: `app/App.jsx`, `app/MovementControllerRecomp.jsx`, `app/pressed-keys.css`, `app/styles.css`, `src/view-menu.json`, and `electron/menu.cjs`.
