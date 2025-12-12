import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import type {ReportPluginResult, AnalysisContext} from '../types.js';

export async function runPublint(
  _context: AnalysisContext
): Promise<ReportPluginResult> {
  // TODO: check that node modules exists

  const result: ReportPluginResult = {
    messages: []
  };

  const publintResult = await publint({pack: 'auto'});
  for (const problem of publintResult.messages) {
    result.messages.push({
      severity: problem.type,
      score: 0,
      message: formatMessage(problem, publintResult.pkg) ?? ''
    });
  }

  return result;
}
