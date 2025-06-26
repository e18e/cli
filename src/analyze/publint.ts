import {publint} from 'publint';
import {formatMessage} from 'publint/utils';
import {Message} from '../types.js';

export async function runPublint(tarball: ArrayBuffer) {
  const messages: Message[] = [];

  const result = await publint({pack: {tarball}});
  for (const problem of result.messages) {
    messages.push({
      severity: problem.type,
      score: 0,
      message: formatMessage(problem, result.pkg) ?? ''
    });
  }

  return messages;
}
