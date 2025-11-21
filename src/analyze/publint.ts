import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import type {ReportPluginResult, Options, AnalysisContext} from '../types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function runPublint(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const targetTarballs = context.options?.targetTarball;

  if (targetTarballs && targetTarballs.length > 0) {
    return runPublintWithTarballs(targetTarballs, context.options);
  }

  return {messages: []};
}

export async function runPublintWithTarballs(
  targetTarballs: string[],
  options?: Options
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };
  const root = options?.root || process.cwd();

  for (const targetTarball of targetTarballs) {
    const targetTarballPath = path.resolve(root, targetTarball);
    // TODO (jg): handle failed reads gracefully
    const buffer = await fs.readFile(targetTarballPath);
    const tarball = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const publintResult = await publint({pack: {tarball}});
    for (const problem of publintResult.messages) {
      result.messages.push({
        severity: problem.type,
        score: 0,
        message: formatMessage(problem, publintResult.pkg) ?? ''
      });
    }
  }

  return result;
}
