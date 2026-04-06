import {writeFile} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as webCodemods from '@e18e/web-features-codemods';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateSyntaxReplacements() {
  let newCode = `import type {SyntaxReplacement} from '../types.js';\n`;
  newCode += `import * as webCodemods from '@e18e/web-features-codemods';\n\n`;
  newCode += `export const fixableSyntaxReplacements: SyntaxReplacement[] = [\n`;

  let count = 0;

  const exportedNames = Object.keys(webCodemods);

  for (const exportName of exportedNames) {
    const codemod = (webCodemods as Record<string, any>)[exportName];

    if (codemod && typeof codemod.test === 'function' && typeof codemod.apply === 'function') {

      newCode += `  {\n`;
      newCode += `    name: '${exportName}',\n`;
      newCode += `    codemod: webCodemods['${exportName}']\n`;
      newCode += `  },\n`;
      count++;
    }
  }

  newCode += `];\n`;

  const outputPath = join(
    __dirname,
    '..',
    'src/commands',
    'fixable-syntax-replacements.ts'
  );
  await writeFile(outputPath, newCode);

  console.log(
    `✅ Generated fixable-syntax-replacements.ts with ${count} codemods`
  );
  console.log(`📁 Output: ${outputPath}`);
}

generateSyntaxReplacements().catch((error) => {
  console.error('Failed to generate syntax replacements:', error);
  process.exit(1);
});
