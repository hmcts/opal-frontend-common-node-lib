const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const required = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/global.d.ts',
  'dist/session.d.ts',
];
const allowedRootFiles = new Set(['package.json', 'README.md', 'LICENSE']);

const env = { ...process.env };
if (!env.npm_config_cache) {
  const cacheRoot = env.RUNNER_TEMP || os.tmpdir();
  env.npm_config_cache = path.join(cacheRoot, 'npm-cache-opal-common-node');
}

const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  env,
  encoding: 'utf-8',
});

if (pack.status !== 0) {
  process.stderr.write(pack.stdout || '');
  process.stderr.write(pack.stderr || '');
  process.exit(pack.status ?? 1);
}

const output = (pack.stdout || '').trim();
const firstBracket = output.indexOf('[');
const lastBracket = output.lastIndexOf(']');
const jsonSlice = firstBracket >= 0 && lastBracket > firstBracket ? output.slice(firstBracket, lastBracket + 1) : output;

let parsed;
try {
  parsed = JSON.parse(jsonSlice);
} catch (error) {
  console.error('Failed to parse `npm pack --dry-run --json` output.');
  console.error(jsonSlice);
  throw error;
}

const files = parsed?.[0]?.files;
if (!Array.isArray(files)) {
  console.error('Unexpected npm pack output shape.');
  process.exit(1);
}

const fileSet = new Set(files.map((entry) => entry.path));
const missingRequired = required.filter((file) => !fileSet.has(file));
const unexpected = files
  .map((entry) => entry.path)
  .filter((file) => !file.startsWith('dist/') && !allowedRootFiles.has(file));

if (missingRequired.length || unexpected.length) {
  if (missingRequired.length) {
    console.error('Missing required packed files:');
    for (const file of missingRequired) {
      console.error(`- ${file}`);
    }
  }

  if (unexpected.length) {
    console.error('Unexpected packed files:');
    for (const file of unexpected) {
      console.error(`- ${file}`);
    }
  }

  process.exit(1);
}

console.log('npm pack publish shape is valid.');
