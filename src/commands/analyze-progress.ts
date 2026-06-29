import * as prompts from '@clack/prompts';
import {styleText} from 'node:util';
import type {PhasedRunner, ReportPhase} from '../types.js';

const COMPLETE_SYMBOL = styleText('green', '◈');
const ERROR_SYMBOL = styleText('red', '◈');

function finishPhase(
  spinner: ReturnType<typeof prompts.spinner>,
  title: string,
  symbol: string
) {
  spinner.clear();
  prompts.log.message(title, {symbol, spacing: 0});
}

export function createAnalyzePhasedRunner(): PhasedRunner {
  return async (phases: ReportPhase[]) => {
    for (const {title, run} of phases) {
      const s = prompts.spinner();
      s.start(title);
      try {
        await run();
        finishPhase(s, title, COMPLETE_SYMBOL);
      } catch (err) {
        finishPhase(s, title, ERROR_SYMBOL);
        throw err;
      }
    }
  };
}
