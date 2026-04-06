import {glob} from 'tinyglobby';
import type {ReportPluginResult, AnalysisContext} from '../types.js';
import {fixableSyntaxReplacements} from '../commands/fixable-syntax-replacements.js';

export async function runSyntaxReplacements(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  const cwd = context.root;
  // should we only check src/ ?
  const files = await glob(['**/*.{ts,tsx,js,jsx}', '!node_modules'], {
    cwd,
    absolute: true
  });

  for (const filename of files) {
    try {
      const source = await context.fs.readFile(filename);

      for (const replacement of fixableSyntaxReplacements) {
        if (replacement.codemod.test({source})) {
          result.messages.push({
            severity: 'suggestion',
            score: 0,
            message: `File "${filename}" can be updated: ${replacement.name}.`,
            fixableBy: 'migrate'
          });
          break;
        }
      }
    } catch (error) {
      continue;
    }
  }

  return result;
}
