import {glob} from 'tinyglobby';
import {join, relative} from 'node:path';
import * as WebFeatureCodemodExports from '@e18e/web-features-codemods';
// TODO: change this once CodeMod is exported from @e18e/web-features-codemods
import type {CodeMod} from '@e18e/web-features-codemods/lib/shared.js';
import type {AnalysisContext, ReportPluginResult} from '../types.js';
import {SOURCE_GLOB, SOURCE_IGNORE} from '../utils/source-files.js';

function isWebFeatureCodemod(value: unknown): value is CodeMod {
  return (
    typeof value === 'object' &&
    value !== null &&
    'test' in value &&
    typeof value.test === 'function' &&
    'apply' in value &&
    typeof value.apply === 'function'
  );
}

const webFeatureCodemods = Object.entries(WebFeatureCodemodExports).filter(
  (entry): entry is [string, CodeMod] => isWebFeatureCodemod(entry[1])
);

export async function runWebFeaturesCodemodsAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const messages: ReportPluginResult['messages'] = [];

  const srcGlobs = context.options?.src;
  const patterns = srcGlobs && srcGlobs.length > 0 ? srcGlobs : SOURCE_GLOB;
  const allFiles = await glob(patterns, {
    cwd: context.root,
    ignore: SOURCE_IGNORE
  });
  // filter out any paths that escaped context.root via ../
  const files = allFiles.filter(
    (f) => !relative(context.root, join(context.root, f)).startsWith('..')
  );

  for (const filePath of files) {
    let source: string;
    try {
      source = await context.fs.readFile(filePath);
    } catch {
      continue;
    }

    const matches: string[] = [];
    for (const [name, codemod] of webFeatureCodemods) {
      try {
        if (codemod.test({source})) {
          matches.push(name);
        }
      } catch {
        continue;
      }
    }

    if (matches.length > 0) {
      messages.push({
        severity: 'suggestion',
        score: 0,
        message: `File "${filePath}" can use newer web features: ${matches.join(', ')}.`
      });
    }
  }

  return {messages};
}
