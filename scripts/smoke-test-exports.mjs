import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const runtimeSpecifiers = Object.entries(pkg.exports || {})
  .filter(([, exportConditions]) => typeof exportConditions === 'object' && exportConditions.import)
  .map(([subpath]) => (subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`));

for (const specifier of runtimeSpecifiers) {
  await import(specifier);
}

console.log('Runtime export smoke test passed.');
