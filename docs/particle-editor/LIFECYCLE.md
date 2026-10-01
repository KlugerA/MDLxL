# Real-source lifecycle evidence

Checkpoint 9, 30 September 2026. The isolated native-renderer harness captured 99 samples from three indexed recipes, at 15%, 50% and 90% of every available Birth, Stand, Attack, Spell, Death, Decay or Dissipate clip. Matching is case-insensitive and includes compound clip names.

All 99 samples completed without JavaScript errors or non-finite particle positions, velocities or ribbon vertices. Canonical source recipes remained unchanged. Thirteen samples contained active geometry; inactive samples were retained without changing visibility or emission to make them appear. These are discrete editor-preview samples, not continuous lifecycle or Warcraft-game acceptance.

| Recipe | Source | Samples | Active samples | Appearance observed |
|---|---|---:|---:|---|
| wc3-838fc48f5ca1aa51639306d7 | units\creeps\golemstatue\golemstatue.mdx | 30 | 2 | Gray dust clusters during Death |
| wc3-b77c9b1c56c50dec1ffcfd04 | units\creeps\direwolf\direwolf.mdx | 33 | 2 | Twin blue ribbon arcs during Attack Slam |
| wc3-eb436de856fa4d1e5ddf2d62 | units\orc\heroblademaster\heroblademaster.mdx | 36 | 9 | Golden slash in Attack 2; orange/gold sparks at the end of Attack Slam |

Source identity: Warcraft III 3.0.0.24268; source key `6d608eb1d5ea6a375afbb253c7679d4fcd82d545712358382cbe01cb8534ea60`.

- `wc3-838fc48f5ca1aa51639306d7`: SHA-256 `dabb861e694c907d35bff72135961054fc93cb71131544365854fffe7bc47689`. Clips: Stand, Stand 2, Stand 3, Stand Ready, Attack, Attack spell, Spell Slam, Birth, Death, decay.

- `wc3-b77c9b1c56c50dec1ffcfd04`: SHA-256 `bbc7dc3d2a5b9b1b234b96e0f9dcadd3d4b8551e73179c73656071ec1c90d44c`. Clips: Stand, Stand - 2, Spell Slam, Attack - 1, Stand - 3, Attack - 2, Birth, Attack Slam, Death, Decay Flesh, Decay Bone.

- `wc3-eb436de856fa4d1e5ddf2d62`: SHA-256 `0464bc7095533aad067439d9e47cda341209b70456f1e24906099ada8547a961`. Clips: Stand - 2, Stand cinematic, Attack, Attack Slam, Stand - 4, Death, Stand, Attack 2, Stand Ready, Stand Victory, Dissipate, Attack Walk Stand Spin.

Run `node test/particle-lifecycle.electron.cjs` after building dist and indexing the configured installation. The harness uses a private profile and the local indexed source cache. Ignored evidence: `out/particle-prototype/lifecycle/results.json` and `lifecycle-0.png` through `lifecycle-10.png`. The hash-bound appearance names and chosen sample times are in `src/particle-reviewed-names.json`; no Warcraft asset bytes or captured game textures are committed.
