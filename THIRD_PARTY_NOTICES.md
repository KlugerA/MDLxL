# Third-party components and reference assets

Exact dependency versions and transitive packages are recorded in `package-lock.json`. Their respective license terms continue to apply.

- **war3-model 4.0.1**, 4eb0da and contributors — MIT. Model parsing/generation, BLP1 decoding and Warcraft rendering. [Project source](https://github.com/4eb0da/war3-model).
- **Three.js 0.183.2**, three.js authors — MIT. Editing viewport, math, camera controls and texture loaders.
- **React / React DOM 19.2.4**, Meta Platforms, Inc. and affiliates — MIT.
- **Lucide React 0.577.0**, Lucide contributors — ISC; inherited Feather icons under MIT.
- **buffer 6.0.3**, Feross Aboukhadijeh and contributors — MIT.
- **gl-matrix 3.3.0**, Brandon Jones, Colin MacKenzie IV and contributors — MIT.
- **Electron 40.8.0**, Electron contributors — MIT. Chromium's component notices accompany its runtime.
- **Vite 7.3.1** and **esbuild** — MIT; build/development tools.

## Original MDLVis assets

The toolbar images under `public/classic/` and `original.ico` were extracted from the user's authorized reference copy of **MDLVis 1.41**. The original bitmap toolbar graphics were converted to PNG where required for the rebuilt UI. They are original-program assets, not newly authored icons.

The reference program's About resource credits **Alexey2005**, dated **19 August 2008**, and acknowledges its project/community contributors. Those original authors retain their rights. This rebuild makes no claim of authorship over, or grant of a new license for, those assets. The supplied rebuild is prepared for the user's local use; this notice is not a statement that unrestricted redistribution of original assets is licensed.

The main form's controls, captions and placement were studied from the 1.41 resource tree. Published 1.40 Delphi source was also used to understand behavior and shortcuts. The rebuild has new JavaScript/Electron implementations; its distribution does not include the original MDLVis executable or Delphi runtime. Earlier wording that described every legacy asset as merely a research reference no longer applies to this classic rebuild.

Original documentation and additional provenance are linked in the [Hive/XGM research report](docs/COMMUNITY_RESEARCH.md), including its original MDLVis documentation sources. The new MPQ reader identifies StormLib's `SBaseCommon.cpp` as a file-format reference in its source comments; it does not load a legacy Storm DLL.

## Warcraft data

Warcraft III, its artwork and game assets belong to their respective owners, including Blizzard Entertainment. The Peon and Wisp toolbar portraits (`public/classic/peon.png` and `wisp.png`) were converted from `ReplaceableTextures\\CommandButtons\\BTNPeon.blp` and `BTNWisp.blp` in the user's local Warcraft III MPQ, at the user's request.

The following six command-card/ability-style toolbar images were also converted from that authorized local classic MPQ using the source-maintenance script `work/extract-warcraft-command-icons.cjs`:

| Rebuild image | Warcraft III source entry | Toolbar meaning |
| --- | --- | --- |
| `public/classic/wc3-select.png` | `ReplaceableTextures\\CommandButtons\\BTNMarksmanship.blp` | Select / target |
| `public/classic/wc3-move.png` | `ReplaceableTextures\\CommandButtons\\BTNMove.blp` | Move |
| `public/classic/wc3-rotate.png` | `ReplaceableTextures\\CommandButtons\\BTNWhirlwind.blp` | Rotate |
| `public/classic/wc3-zoom.png` | `ReplaceableTextures\\CommandButtons\\BTNTelescope.blp` | Zoom / view |
| `public/classic/wc3-save.png` | `ReplaceableTextures\\CommandButtons\\BTNScroll.blp` | Save / document |
| `public/classic/wc3-delete.png` | `ReplaceableTextures\\CommandButtons\\BTNCancel.blp` | Delete / cancel |

These interface images retain their owners' rights; no new license is granted for them. Game archives and extracted game models are not bundled. The application reads locally available game data for preview. The retained demo fixture is project-authored geometry and is not the classic shell's startup model.

## CascLib

Native Warcraft III CASC reader by Ladislav Zezula, MIT. License and pinned binary provenance are in electron/casc/. The helper code is included as electron/CascBridge.cs. No Warcraft installation archives or general game-texture cache are shipped. The three specifically bundled Human console textures are documented below.

## Local Human portrait frame

`electron/portrait-local/humanuitile01.dds`, `humanuitile02.dds`, and `humanuiportraitmask.dds` are unmodified Blizzard Entertainment Warcraft III UI assets, merged from the user's MDLxL Local Portrait Patch. They supply the Human console surround, golden portrait border and mask locally; a Warcraft installation is not needed for this frame. These assets retain their owner's rights; no new redistribution license or asset ownership is claimed. Unit portrait models and their textures are not included by this fix.

## FFmpeg preview GIF encoder

Desktop GIF export invokes FFmpeg 8.1.2, copyright the FFmpeg developers, as a separate executable under LGPL-2.1. The pinned Windows build is serversideup/ffmpeg-lgpl-builds v8.1.2-27, with GPL, nonfree, version3 and optional autodetection disabled. Actual binary hashes/configuration and source provenance are in `electron/ffmpeg/PROVENANCE.json` and `SOURCE.txt`; complete applicable license texts accompany the executable and its required runtime DLLs in that directory. MDLxL does not link FFmpeg libraries and uses no ShareX code.

Redistribute the companion **MDLxL-FFmpeg-corresponding-source.zip** with this application and make it available alongside every application download. It contains the exact FFmpeg source archive, pinned build scripts, and dependency source/build records. `electron/ffmpeg/REDISTRIBUTION.md` describes the contents and rebuilding. Users may replace the FFmpeg executable and runtime DLLs; no technical restriction is imposed by MDLxL at runtime. Packaging verifies the reviewed build to prevent accidental omission or substitution.

Runtime dependencies: Intel oneVPL (MIT), OpenH264 (BSD-2-Clause), mingw-w64 winpthreads (permissive), GCC libgcc/libstdc++ (GPLv3 with the GCC Runtime Library Exception). These do not enable GPL components in FFmpeg. Full GCC base license and runtime exception texts are included. The browser development GIF encoder remains in `src/vendor/gifenc.js`; its original license header is retained.

## Forge toolbar icon

`public/classic/wc3-forge.gif` is Blizzard Entertainment’s Warcraft III Storm Hammers artwork, obtained from the official classic Battle.net Gryphon Rider unit page at the user’s request. Source: https://classic.battle.net/war3/images/human/upgrades/stormhammers.gif ; context: https://classic.battle.net/war3/human/units/gryphonrider.shtml . The artwork retains its owner’s rights.

## Clipper geometry dependency

Forge uses clipper-lib 6.4.2 (Angus Johnson / Timo), with embedded JSBN by Tom Wu. The complete Boost Software License and JSBN notice are in docs/licenses/clipper-lib.txt in the source, and LICENSES.bundled.txt in the portable package.

## Tengwar Annatar typeface (Mordor mode)

Mordor mode uses the unmodified **Tengwar Annatar 1.20** type family by Johan Winge (2004–2005), distributed as freeware. Its complete original package—including all face variants, `readme.txt`, licence text, and documentation PDF—is retained under `public/fonts/tengwar-annatar/` and copied intact to `dist/fonts/tengwar-annatar/` in the portable package. The original licence permits no-fee redistribution only when all original files are included unchanged; it also notes that commercial use and use of Tolkien's script may require additional permission. The typeface is used here solely as an optional, local, humorous UI mode.

