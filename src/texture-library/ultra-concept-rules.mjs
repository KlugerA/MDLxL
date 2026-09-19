/**
 * Evidence-preserving, deterministic concept associations for the native atlas.
 *
 * This module never claims to have inspected an image. Direct features are read
 * from existing positive description clauses or material annotations. A native
 * subject can suggest a mood or fantasy theme, but such rows ALWAYS retain
 * related:true and explain the association. A lower strength is a ranking hint,
 * not a visual confidence probability.
 *
 * Match subject names and the texture's own filename, not every parent directory
 * or model reference: BloodSput under Abomination must not acquire a monster face.
 * Explicit paths in a rule are reserved for the few native spell/source contexts
 * whose path itself is the relevant evidence.
 */

const feature = (ids, note, extra = {}) => ({ ids: ids.split('|'), note, strength: .96, ...extra });
const subject = (ids, name, strength = .64, extra = {}) => ({ ids: ids.split('|'), name, strength, related: true, ...extra });
const association = (ids, note, strength = .55, extra = {}) => ({ ids: ids.split('|'), note, strength, related: true, ...extra });

// Only literal descriptive evidence belongs here. For instance, one large eye
// does not prove many eyes, and a Faceless One is not automatically eyeless.
export const DIRECT_NOTE_RULES = [
 feature('viscera', /\b(?:viscera|visceral|organs?|intestines?|entrails|guts)\b/),
 feature('wounds', /\b(?:wounds?|wounded|gashes?|lacerations?|open sores?|claw scratch marks)\b/),
 feature('festering', /\b(?:festering|festered|suppurating|infected wounds?|pus filled|oozing sores?)\b/),
 feature('pustules', /\b(?:pustules?|pustular|boils?|blisters?|pimples?)\b/),
 feature('veiny', /\b(?:veins?|veined|veiny|vascular)\b/),
 feature('tentacles', /\b(?:tentacles?|tentacled|tentacular|tendrils?)\b/),
 feature('many-eyes', /\b(?:many|multiple|several|numerous|cluster of) eyes\b/),
 feature('eyeless', /\b(?:eyeless|without eyes|empty eye sockets|missing eyes)\b/),
 feature('snarling', /\b(?:snarling|snarled|snarl|growling)\b/),
 feature('screaming', /\b(?:screaming|scream|shrieking|yelling|howling mouth)\b/),
 feature('fanged', /\b(?:fangs?|fanged|fang like|vampire teeth)\b/),
 feature('horned', /\b(?:horns?|horned|antlers?|antlered)\b/),
 feature('tusked', /\b(?:tusks?|tusked)\b/),
 feature('insectoid', /\b(?:insect|insectoid|insect like|spider like|arachnid|beetle|scorpion|carapace)\b/),
 feature('reptilian', /\b(?:reptile|reptilian|reptilian scales|lizard|snake|serpent|crocodile)\b/),
 feature('aquatic', /\b(?:aquatic|fish like|walrus like|turtle|fish skin|fins?|gills?)\b/),
 feature('winged', /\b(?:wings?|winged|wing sections?|wing membrane)\b/),
 feature('batwing', /\b(?:bat wings?|batwing|bat like wings?)\b/),
 feature('undead-theme', /\b(?:undead|zombie|ghoul|corpse|corpses|skeletal limbs|skeletal face)\b/),
 feature('demonic-theme', /\b(?:demon|demons|demonic|demoness)\b/),
 feature('necromantic', /\b(?:necromantic|necromancy|necromancer)\b/),
 feature('occult', /\b(?:occult|ritual circle|summoning circle|pentagram|pentacle)\b/),
 feature('cursed', /\b(?:cursed|accursed|hexed)\b/),
 feature('enchanted', /\b(?:enchanted|enchantment|magical)\b/),
 feature('arcane', /\b(?:arcane|arcanic)\b/),
 feature('holy', /\b(?:holy|sacred|divine|consecrated)\b/),
 feature('regal', /\b(?:regal|royal|royalty|kingly|crown|crowns)\b/),
 feature('barbaric', /\b(?:barbarian|barbaric|barbarian style)\b/),
 feature('tribal-theme', /\b(?:tribal|totems?|totemic|war paint|warpaint)\b/),
 feature('druidic', /\b(?:druid|druidic|druidical)\b/),
 feature('gothic', /\b(?:gothic)\b/),
 feature('infernal-theme', /\b(?:infernal|hellish|hellfire)\b/),
 feature('celestial', /\b(?:celestial|astral|constellation|constellations)\b/),
 feature('frost-magic', /\b(?:frost magic|ice magic|magical frost|magical ice)\b/),
 feature('dark-magic', /\b(?:dark magic|shadow magic|necrotic magic|void magic)\b/),
 feature('nature-magic', /\b(?:nature magic|nature spell|magical vines|magical leaves)\b/),
 feature('fire-magic', /\b(?:fire magic|magical flames?|magical fire)\b/),
 feature('lightning-magic', /\b(?:lightning magic|magical lightning|lightning spell)\b/),
 feature('nautical', /\b(?:nautical|ship hull|ship planks|sailcloth|sail cloth|sails?|boat hull)\b/),
 feature('steampunk', /\b(?:steampunk)\b/),
 feature('alchemical', /\b(?:alchemical|alchemy|alchemist)\b/),
];

// Subjective aesthetic words stay suggestions even when strong descriptive
// evidence motivates them. A decayed ghoul face is a useful ugly-face suggestion;
// it is not an objective reviewed-image annotation named "ugly".
export const RELATED_NOTE_RULES = [
 association('disgusting|grotesque|horror|creepy', /\b(?:bloody organs?|viscera|entrails|guts|exposed flesh|corpse pieces|decayed|diseased face|red wounds?)\b/, .81),
 association('ugly|grotesque|disgusting|creepy', /\b(?:diseased|decayed|corpse|bloody organs?|stitched exposed|exposed ribs|tentacled)\b/, .77, { allTags: ['face'] }),
 association('ugly|creepy|monstrous', /\b(?:snarling|sharp teeth|toothy face|toothed mouth)\b/, .55, { allTags: ['face'] }),
 association('disgusting|horror', /\b(?:blood splatter|blood splash|blood spurt|blood streak|blood cloud|blood particle|red wounds?)\b/, .67),
 association('disgusting', /\b(?:slimy|slime|ooze|oozing|sludge|sewage|festering|pus|rotting|rotten|decaying|mouldy|moldy)\b/, .67),
 association('grotesque|eldritch|creepy|monstrous', /\b(?:tentacles?|tentacled|tentacular|fleshy tendrils?)\b/, .72),
 association('horror|creepy', /\b(?:skeletal face|skeletal limbs|skulls?|corpse|exposed ribs|ghostly face|ghostly|shroud)\b/, .51),
 association('monstrous|creepy', /\b(?:sharp teeth|toothy face|toothed mouth|large eye|red eyed tree face)\b/, .53),
 association('fanged', /\b(?:sharp teeth|toothy face|toothed mouth|teeth bearing)\b/, .5),
 association('batwing', /\b(?:wing membrane|leathery wings?)\b/, .46),
 association('festering', /\b(?:diseased|decayed|red wounds?|rotting flesh|corpse skin)\b/, .43),
 association('necromantic|dark-magic', /\b(?:skull|skeletal|corpse)\b/, .43, { anyTags: ['magic', 'rune', 'undead-body'] }),
 association('occult|enchanted', /\b(?:runic|runes?|sigils?|glyphs?|magical panels?)\b/, .49),
 association('regal', /\b(?:gold trim|gold edging|gold ornaments?|gold borders?|gold armor|gold armour|lion medallion|heraldic)\b/, .39, { anyTags: ['plate', 'cloth', 'emblem'] }),
 association('barbaric|tribal-theme', /\b(?:loincloth|wolf pelt|stitched hide|carved wooden totem|painted markings)\b/, .54),
 association('nature-magic|druidic', /\b(?:tree faces?|tree face|bark like limbs|leaf panels|decorative leaves)\b/, .51, { anyTags: ['face', 'magic', 'elf-body'] }),
 association('steampunk', /\b(?:machinery|mechanical harness|gears?|pipes?|pistons?|boilers?|steam|cogs?)\b/, .54, { anyTags: ['metal', 'plate', 'glass'] }),
 association('alchemical', /\b(?:bottles?|flasks?|vials?|beakers?|potions?)\b/, .54),
 association('celestial', /\b(?:crescent|moon|star shaped|star pattern|stars?|starfield)\b/, .45, { anyTags: ['magic', 'glow', 'pattern'] }),
];

export const RELATED_SUBJECT_RULES = [
 // Horror and unpleasant appearances: face-only rules preserve the requested
 // anatomy and avoid expanding every orc/elf/human into an ugly face.
 subject('ugly|disgusting|grotesque|horror|creepy|monstrous', /\b(?:abomination|flesh golem|ghoul|zombie)\b/, .85, { allTags: ['face'] }),
 subject('disgusting|grotesque|horror|creepy|monstrous', /\b(?:abomination|flesh golem|ghoul|zombie|gutz|guts|meat ?wagon)\b/, .79),
 subject('viscera', /\b(?:gutz|guts|abomination|meat ?wagon)\b/, .73),
 subject('ugly|grotesque|creepy|monstrous|eldritch', /\b(?:faceless one|forgotten one)\b/, .8, { allTags: ['face'] }),
 subject('eldritch|monstrous|grotesque|creepy|horror', /\b(?:faceless one|forgotten one)\b/, .82),
 subject('ugly|creepy|monstrous', /\b(?:crypt fiend|fel ?(?:hound|stalker)|gargoyle)\b/, .65, { allTags: ['face'] }),
 subject('ugly|grotesque|monstrous', /\b(?:murloc mutant|ogre|ogre lord|ogre one headed)\b/, .45, { allTags: ['face'] }),
 subject('monstrous', /\b(?:ogre|minotaur|wendigo|sasquatch|magnataur|sea giant|mountain giant|murloc|mur ?gul|hydra|chimera|chimaera|satyr|gnoll|razormane|nerubian|lobstrokk|arachnathid)\b/, .61),
 subject('disgusting', /\b(?:slime|sludge|sewer|sewage|plague|disease|carrion|cannibalize|cannibalise|cannibalism|carrion swarm|carrionswarm)\b/, .63),
 subject('horror|creepy|undead-theme|necromantic', /\b(?:skeleton|skeletal|lich|ghoul|zombie|abomination|flesh golem|banshee|revenant|necromancer|crypt fiend|death ?knight|undead arthas)\b/, .69),
 subject('horror|creepy|gothic|necromantic', /\b(?:necropolis|ziggurat|crypt|graveyard|boneyard|bone yard|tomb|mausoleum|gargoyle spire|sacrificial altar|slaughter ?house|temple of the damned)\b/, .66),
 subject('horror|creepy|ghostly', /\b(?:banshee|ghost|revenant|shade|phantom|spirit tower|spirit walker)\b/, .57),
 subject('creepy|horror', /\b(?:creepy|scary|death scream|death smug)\b/, .73),
 subject('cursed|evil|dark-magic', /\b(?:corrupted ent|corrupted tree|blight|blighted|felwood|possess|possession|curse|cursed|haunted|unholy|doom|dark ritual)\b/, .65),
 subject('ugly|creepy|monstrous', /\b(?:corrupted ent)\b/, .62, { allTags: ['face'] }),

 // Demonic native subjects. These mean a useful fantasy reference association;
 // named appearances are never inferred for all textures used by their models.
 subject('demonic-theme|infernal-theme|evil|horror', /\b(?:demoness|dread ?lord|tichondrius|pit ?lord|mannoroth|archemonde|archimonde|kil ?jaeden|eredar|doom ?g(?:uard|aurd)|fel ?g(?:uard|aurd)|fel ?hound|fel ?stalker|infernal|diablo)\b/, .72),
 subject('demonic-theme|evil|dark-magic', /\b(?:chaos warlock|chaos warlord|chaos grunt|chaos peon|fel orc|warlock guldan|demon gate|demon rune|demonized)\b/, .67),
 subject('demonic-theme|batwing|horror', /\b(?:dread ?lord|tichondrius|pit ?lord|mannoroth|doom ?g(?:uard|aurd))\b/, .58, { allTags: ['wing'] }),
 subject('eldritch|dark-magic|cursed', /\b(?:void ?walker|forgotten one|faceless one|obsidian statue|destroyer new)\b/, .64),
 subject('occult|necromantic|dark-magic', /\b(?:necromancer|lich|kel ?thuzad|acolyte|death ?knight|undead arthas|sacrificial altar|temple of the damned|dark ritual)\b/, .68),
 subject('dark-magic|necromantic|cursed', /\b(?:frostm? ?mourne|frostmourne|unholy|death coil|death pact|animate dead|raise dead|dark summoning|death and decay)\b/, .72),

 // Fantasy traditions and magical styles supported by native names.
 subject('arcane|enchanted', /\b(?:arch ?mage|human mage|bandit mage|sorceress|sorcerer|wizard|medivh|jaina|dalaran|arcane|spell thief|spell breaker|spellbreaker)\b/, .67),
 subject('arcane|enchanted', /\b(?:hero blood elf|blood mage|kael|kaelthas|kael thas|magic vault|arcane sanctum|arcane tower)\b/, .64),
 subject('holy', /\b(?:hero ?paladin|paladin|uther|priest|altar of kings|holy light|divine shield|resurrection|devotion aura|inner fire)\b/, .68, { excludeName: /\b(?:dark troll|forest troll|ice troll|shadow priest|blood priest)\b/ }),
 subject('regal', /\b(?:king|kings|queen|royal|lord garithos|proudmoore|castle|throne|crown|knight|paladin)\b/, .55),
 subject('barbaric|tribal-theme', /\b(?:grunt|peon|head ?hunter|beserk head hunter|berserk|berserker|razormane|tauren|spirit walker|koto beast|kodo beast|ogre|beast master|beastmaster|war mill|great hall|stronghold|orc barracks)\b/, .56),
 subject('tribal-theme|occult', /\b(?:witch doctor|witchdoctor|shaman|shadow hunter|spirit lodge|voodoo lounge|totem|shadow priest)\b/, .59),
 subject('druidic|nature-magic|enchanted', /\b(?:druid|druidoftheclaw|druidotthe talon|keeperofthegrove|keeper of the grove|furion|mal furion|malfurion|dryad|good ent|treant|wisp|keeper vines|keeper statue|force of nature|ancient of lore|ancient of wind|ancient of war|tree of life|tree of ages|tree of eternity)\b/, .72),
 subject('nature-magic|enchanted', /\b(?:faerie dragon|fairy dragon|pixies|entangling roots|tranquility|force of nature|rejuvenation|thorns aura|treant)\b/, .68),
 subject('celestial|nature-magic', /\b(?:priestess of the moon|moon well|moonwell|moon crescent|starfall|star field|starfield|moon glaive|elune|sentinel)\b/, .58),
 subject('infernal-theme|fire-magic', /\b(?:infernal|hellfire|rain of fire|flame strike|flamestrike|immolation|soul burn|soulburn|phoenix|fire lord|firelord|lava spawn|doom|burning)\b/, .65),
 subject('fire-magic', /\b(?:fire brew master|flame|fireball|ring o fire|breath of fire|incinerate|liquid fire)\b/, .58),
 subject('frost-magic', /\b(?:frost wyrm|frost nova|frost armor|frost armour|frost bolt|frostbolt|blizzard|ice shard|cold arrow|freezing breath|breath of frost|frostm? ?mourne|frostmourne|hero lich)\b/, .66),
 subject('lightning-magic', /\b(?:lightning|chain lightning|forked lightning|storm bolt|storm hammer|storm brew master|thunder clap|purge|monsoon)\b/, .68),
 subject('enchanted|arcane', /\b(?:teleport|portal|blink|mass teleport|summon|polymorph|mana|spell|rune|crystal ball|sorcery)\b/, .51),
 subject('occult', /\b(?:sacrificial|summoning circle|demon rune|warlock|necromancer|pentagram|dark ritual|voodoo)\b/, .63),
 subject('alchemical|steampunk', /\b(?:goblin alchemist|alchemist|chemical rage|healing spray|acid bomb|transmute)\b/, .7),
 subject('alchemical', /\b(?:potion|elixir|vial|flask|bottle|laboratory|apothecary|alchem)\b/, .61),
 subject('steampunk', /\b(?:tinker|tinker tank|tinker building|clockwerk|clockwork|steam ?tank|siege ?engine|gyrocopter|flying machine|goblin zep(?:p|)lin|goblin zeppelin|goblin shredder|mechanical critter|pocket factory|engineering|workshop|goblin laboratory)\b/, .72),
 subject('nautical', /\b(?:ship|ships|battle ?ship|destroyer ship|transport ship|fishingt? ship|boat|boats|juggernaut|juggernaught|harbor|harbour|shipyard|dock|docks|anchor|sail|sails)\b/, .68),
 subject('aquatic|nautical', /\b(?:naga|mur ?gul|murloc|sea giant|sea turtle|sea witch|seawitch|sea serpent|snap dragon|hydra|lobstrokk|shark|coral|tidal guardian|turtle|wind serpent)\b/, .59),
 subject('insectoid|monstrous', /\b(?:crypt fiend|crypt lord|nerubian|spider|arachnathid|carrion beetle|locust|zergling|hlisk)\b/, .68),
 subject('reptilian', /\b(?:dragon|dragon spawn|dragonspawn|thunder lizard|salamander|hydra|snake|wind serpent|snap dragon|turtle|naga|skink)\b/, .6),
 subject('winged', /\b(?:gryphon|griffon|griffin|hippogryph|hippogriff|harpy|wyvern|dragonhawk|chimera|chimaera|gargoyle|faerie dragon|phoenix)\b/, .59),
];

export const TAG_CONCEPT_RULES = [
 { ids: ['winged'], anyTags: ['wing'], strength: 1 },
 { ids: ['horned'], anyTags: ['horn'], strength: .93 },
 { ids: ['undead-theme'], anyTags: ['undead-body'], strength: 1 },
 { ids: ['demonic-theme'], anyTags: ['demon-body'], strength: 1 },
 { ids: ['insectoid'], anyTags: ['chitin'], strength: .51, related: true },
 { ids: ['reptilian'], anyTags: ['scales'], strength: .45, related: true },
 { ids: ['disgusting', 'horror'], anyTags: ['blood'], strength: .54, related: true },
 { ids: ['necromantic', 'horror', 'creepy'], anyTags: ['undead-body'], strength: .52, related: true },
 { ids: ['demonic-theme', 'infernal-theme', 'evil', 'monstrous'], anyTags: ['demon-body'], strength: .52, related: true },
 { ids: ['occult', 'enchanted'], anyTags: ['rune'], strength: .46, related: true },
 { ids: ['enchanted'], anyTags: ['magic'], strength: .53, related: true },
 { ids: ['fire-magic', 'infernal-theme'], anyTags: ['fire', 'lava'], allTags: ['magic'], strength: .52, related: true },
 { ids: ['frost-magic'], anyTags: ['ice', 'snow'], allTags: ['magic'], strength: .52, related: true },
 { ids: ['lightning-magic'], anyTags: ['lightning'], allTags: ['magic'], strength: .6, related: true },
 { ids: ['dark-magic'], anyTags: ['shadow'], allTags: ['magic'], strength: .46, related: true },
];

export function ultraWords(value) {
 return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function positiveDescription(value) {
 return String(value || '').replace(/\b(?:without|no) eyes\b/gi, 'eyeless').split(/[.;]/)
  .filter(clause => !/(?:campaign footman offers|\b(?:see|use|try) (?:the |a )?(?:other|campaign)|\bcounterpart\b|\belsewhere\b)/i.test(clause))
  .map(clause => clause.split(/\b(?:no|not|without|rather than|instead of)\b/i)[0])
  .join('. ');
}

function tagPass(rule, tags) {
 return (!rule.allTags || rule.allTags.every(tag => tags.has(tag)))
  && (!rule.anyTags || rule.anyTags.some(tag => tags.has(tag)))
  && (!rule.withoutTags || !rule.withoutTags.some(tag => tags.has(tag)));
}

/** Pure inference; safe for raw catalogue records and prepared items alike. */
export function inferUltraConcepts(item) {
 const tags = item._tags instanceof Set ? item._tags : new Set(item.tags || []);
 const name = ultraWords(item.name);
 const path = String(item.path || '').replace(/\\/g, '/');
 const filename = ultraWords(path.split('/').pop()?.replace(/\.(?:blp|tga|png)$/i, ''));
 const ownName = name + ' ' + filename;
 const note = ultraWords(positiveDescription(item.notes));
 const output = new Map();
 const add = (id, rule, evidence) => {
  const next = { id, strength: rule.strength, evidence, related: !!rule.related };
  const previous = output.get(id);
  if (!previous || (previous.related && !next.related) || previous.related === next.related && next.strength > previous.strength) output.set(id, next);
 };
 for (const rule of [...DIRECT_NOTE_RULES, ...RELATED_NOTE_RULES]) {
  if (!note || !tagPass(rule, tags) || !rule.note.test(note)) continue;
  const evidence = `${rule.related ? 'Related description' : 'Description'}: ${item.notes}`;
  for (const id of rule.ids) add(id, rule, evidence);
 }
 for (const rule of RELATED_SUBJECT_RULES) {
  if (!tagPass(rule, tags) || rule.excludeName?.test(ownName)) continue;
  if (!(rule.name?.test(ownName) || rule.path?.test(path))) continue;
  if (rule.kinds && !rule.kinds.some(kind => item.kinds?.includes(kind))) continue;
  const evidence = `Related native subject: ${item.name || path.split('/').pop()}`;
  for (const id of rule.ids) add(id, rule, evidence);
 }
 for (const rule of TAG_CONCEPT_RULES) {
  if (!tagPass(rule, tags)) continue;
  const matched = [...new Set([...(rule.anyTags || []).filter(tag => tags.has(tag)), ...(rule.allTags || [])])];
  const evidence = `${rule.related ? 'Related material annotation' : 'Material annotation'}: ${matched.join(', ')}`;
  for (const id of rule.ids) add(id, rule, evidence);
 }
 return [...output.values()];
}

export const ULTRA_RULES_VERSION = 1;
export const ULTRA_RULES_STATS = {
 directDescriptionRules: DIRECT_NOTE_RULES.length,
 relatedDescriptionRules: RELATED_NOTE_RULES.length,
 relatedSubjectRules: RELATED_SUBJECT_RULES.length,
 tagRules: TAG_CONCEPT_RULES.length,
};
