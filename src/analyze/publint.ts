import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import {Message} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';

export async function runPublint(fileSystem: FileSystem) {
  const messages: Message[] = [];

  if (!(fileSystem instanceof TarballFileSystem)) {
    return messages;
  }

  const result = await publint({pack: {tarball: fileSystem.tarball}});
  for (const problem of result.messages) {
    messages.push({
      severity: problem.type,
      score: 0,
      message: formatMessage(problem, result.pkg) ?? ''
    });
  }

  return messages;
}
