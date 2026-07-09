import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import type {Message as PublintMessage} from 'publint';
import type {ReportPluginResult, AnalysisContext} from '../types.js';

type FormatMessage = Extract<
  PublintMessage,
  {code: 'FILE_INVALID_FORMAT' | 'FILE_INVALID_EXPLICIT_FORMAT'}
>;

function groupFormatMessages(messages: FormatMessage[]): string {
  const [first] = messages;
  const count = messages.length;
  const {actualFormat, expectFormat, actualExtension, expectExtension} =
    first.args;

  if (first.code === 'FILE_INVALID_EXPLICIT_FORMAT') {
    return `${count} files end with the ${actualExtension} extension, but the code is written in ${actualFormat}. Consider using the ${expectExtension} extension.`;
  }

  return `${count} files are written in ${actualFormat}, but are interpreted as ${expectFormat}. Consider using the ${expectExtension} extension.`;
}

export async function runPublint(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  try {
    const publintResult = await publint({pack: 'auto', pkgDir: context.root});

    const groups = new Map<string, FormatMessage[]>();
    for (const problem of publintResult.messages) {
      if (
        problem.code === 'FILE_INVALID_FORMAT' ||
        problem.code === 'FILE_INVALID_EXPLICIT_FORMAT'
      ) {
        const {actualFormat, expectFormat, expectExtension} = problem.args;
        const key = `${problem.code}:${actualFormat}:${expectFormat}:${expectExtension}`;
        const group = groups.get(key);
        if (group) {
          group.push(problem);
        } else {
          groups.set(key, [problem]);
        }
        continue;
      }

      result.messages.push({
        severity: problem.type,
        score: 0,
        file: 'package.json',
        message: formatMessage(problem, publintResult.pkg) ?? ''
      });
    }

    for (const group of groups.values()) {
      const [first] = group;
      const message =
        group.length === 1
          ? (formatMessage(first, publintResult.pkg) ?? '')
          : groupFormatMessages(group);

      result.messages.push({
        severity: first.type,
        score: 0,
        file: 'package.json',
        message
      });
    }
  } catch (error) {
    console.error(`Failed to run publint: ${error}`);
  }

  return result;
}
