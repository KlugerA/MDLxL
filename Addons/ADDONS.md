# Add-on API 1

Use **Add-ons → Install manifest** to load a JSON command-menu add-on. The example
at `Addons/inspection-example.json` installs three inspection actions. Enable,
disable or remove the menu in the same panel. Installed manifests persist in the
local profile and resume their enabled state on restart.

The initial API is declarative. It supports named commands from `src/commands.js`,
including selection, viewing, mesh and manager commands. An action runs only when
the user presses its button, and the editor's normal enablement, undo and save
guards still apply. There is no arbitrary JavaScript, startup hook or model-data
API in this first version.

Manifest fields: `schema: "mdlxl-addon"`, `apiVersion: 1`, a unique lowercase `id`,
`name`, and 1–32 `actions`. Each action has a unique `id`, `label`, and `command`.
Unsupported API versions, invalid commands and duplicate IDs are rejected before
installation. A failed installation leaves existing add-ons unchanged. Remove an
old version before installing its replacement. Add-ons are separate from portable
interface configurations.
