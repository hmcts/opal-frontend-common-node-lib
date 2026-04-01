const fs = require('node:fs');
const path = require('node:path');

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
const failures = [];

for (const [subpath, exportDefinition] of Object.entries(pkg.exports || {})) {
  if (typeof exportDefinition === 'string') {
    const resolved = path.resolve(exportDefinition.replace(/^\.\//, ''));
    if (!fs.existsSync(resolved)) {
      failures.push(`${subpath} -> ${exportDefinition}`);
    }
    continue;
  }

  for (const [condition, target] of Object.entries(exportDefinition)) {
    if (typeof target !== 'string') {
      continue;
    }

    const resolved = path.resolve(target.replace(/^\.\//, ''));
    if (!fs.existsSync(resolved)) {
      failures.push(`${subpath} (${condition}) -> ${target}`);
    }
  }
}

if (failures.length) {
  console.error('Missing export targets:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Export targets are valid.');
