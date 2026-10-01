const path = require('node:path');

const MODEL_EXTENSION = /\.(?:mdl|mdx|mdlxlpaint)$/i;

function modelPathsFromArguments(args, workingDirectory = process.cwd()) {
  const found = [], seen = new Set();
  for (const value of args || []) {
    if (typeof value !== 'string' || !MODEL_EXTENSION.test(value)) continue;
    const resolved = path.normalize(path.isAbsolute(value) ? value : path.resolve(workingDirectory, value));
    const identity = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (!seen.has(identity)) { seen.add(identity); found.push(resolved); }
  }
  return found;
}

module.exports = { modelPathsFromArguments };
