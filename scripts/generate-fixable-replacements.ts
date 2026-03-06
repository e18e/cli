import {writeFile} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {all} from 'module-replacements';
import {codemods} from 'module-replacements-codemods';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getReplacementTarget(moduleName: string): string {
  const mapping = all.mappings[moduleName];
  if (!mapping?.replacements?.length) return moduleName;

  const firstId = mapping.replacements[0]!;
  const replacement = all.replacements[firstId];
  if (!replacement) return firstId;

  if (replacement.type === 'documented' && replacement.replacementModule) {
    return replacement.replacementModule;
  }

  return replacement.id;
}

async function generateFixableReplacements() {
  let newCode = `import type { Replacement } from '../types.js';\n`;
  newCode += `import { codemods } from 'module-replacements-codemods';\n\n`;
  newCode += `export const fixableReplacements: Replacement[] = [\n`;

  let count = 0;
  for (const moduleName of Object.keys(all.mappings)) {
    if (moduleName in codemods) {
      const to = getReplacementTarget(moduleName);

      newCode += `  {\n`;
      newCode += `    from: '${moduleName}',\n`;
      newCode += `    to: '${to}',\n`;
      newCode += `    factory: codemods['${moduleName}']\n`;
      newCode += `  },\n`;
      count++;
    }
  }

  newCode += `];\n`;

  const outputPath = join(
    __dirname,
    '..',
    'lib/commands',
    'fixable-replacements.ts'
  );
  await writeFile(outputPath, newCode);

  console.log(
    `✅ Generated fixable-replacements.ts with ${count} replacements`
  );
  console.log(`📁 Output: ${outputPath}`);
}

generateFixableReplacements().catch((error) => {
  console.error('Failed to generate fixable replacements:', error);
  process.exit(1);
});
