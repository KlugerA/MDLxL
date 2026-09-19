const fs = require('node:fs');
const path = require('node:path');

/** Local portrait-frame loader for MDLxL's existing preview:humanPortraitFrame
 * handler. An empty lookup list makes resolveTextures return immediately,
 * before game discovery. The same renderer receives the original native DDS
 * tiles, preserving its crop, gold border, transparency and camera geometry.
 * No Warcraft installation, ConsoleUI.fdf, network or profile cache is needed.
 * This owns only the UI surround; it does not replace the selected MDL/MDX.
 */
const HUMAN_PORTRAIT_RESOURCES = Object.freeze([]);
const LOCAL_FILES = Object.freeze(['humanuitile01.dds', 'humanuitile02.dds', 'humanuiportraitmask.dds']);

function validateHumanPortraitResources() {
  return LOCAL_FILES.map(file => {
    const localPath = path.join(__dirname, 'portrait-local', file);
    let bytes;
    try { bytes = fs.readFileSync(localPath); }
    catch { throw Error(`Local Human portrait frame is missing ${file}. Re-extract the complete MDLxL folder, including resources.`); }
    if (bytes.length < 128 || bytes.toString('ascii', 0, 4) !== 'DDS ') throw Error(`Local Human portrait asset ${file} is not a valid DDS file. Re-extract the complete MDLxL folder.`);
    return { name: 'war3.w3mod:ui\\console\\human\\' + file, bytes };
  });
}

module.exports = { HUMAN_PORTRAIT_RESOURCES, validateHumanPortraitResources };
