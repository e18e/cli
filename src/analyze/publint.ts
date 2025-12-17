import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import type {ReportPluginResult, AnalysisContext} from '../types.js';

export async function runPublint(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  try {
    const publintResult = await publint({pack: 'auto', pkgDir: context.root});
    for (const problem of publintResult.messages) {
      result.messages.push({
        severity: problem.type,
        score: 0,
        message: formatMessage(problem, publintResult.pkg) ?? ''
      });
    }
  } catch (error) {
    console.error(`Failed to run publint: ${error}`);
  }

  return result;
}
