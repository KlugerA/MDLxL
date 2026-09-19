#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseMdl, parseMdx } from './index.js';

function usage() {
  return 'Usage:\n  node src/cli.js inspect <model.mdl|model.mdx>\n  node src/cli.js roundtrip <input.mdl|input.mdx> <output>';
}

function parserFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.mdl': return parseMdl;
    case '.mdx': return parseMdx;
    default: throw new Error(`Unsupported extension for ${filePath}. Expected .mdl or .mdx.`);
  }
}

async function main() {
  const [command, inputPath, outputPath] = process.argv.slice(2);
  if (!command || !inputPath || (command === 'roundtrip' && !outputPath)) {
    throw new Error(usage());
  }

  const bytes = await readFile(inputPath);
  const document = parserFor(inputPath)(bytes);

  if (command === 'inspect') {
    process.stdout.write(`${JSON.stringify(document.summary(), null, 2)}\n`);
    return;
  }

  if (command === 'roundtrip') {
    await writeFile(outputPath, document.toBytes(), { flag: 'wx' });
    process.stdout.write(`Wrote an exact ${document.toBytes().length}-byte preservation copy to ${outputPath}\n`);
    return;
  }

  throw new Error(`Unknown command ${JSON.stringify(command)}.\n${usage()}`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
