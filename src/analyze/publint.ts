import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import {ReportPluginResult} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';

export async function runPublint(
  fileSystem: FileSystem
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  if (!(fileSystem instanceof TarballFileSystem)) {
    return result;
  }

  const publintResult = await publint({pack: {tarball: fileSystem.tarball}});
  for (const problem of publintResult.messages) {
    result.messages.push({
      severity: problem.type,
      score: 0,
      message: formatMessage(problem, publintResult.pkg) ?? ''
    });
  }

  return result;
}
