import {describe, it, expect} from 'vitest';
import path from 'node:path';
import {runPublint} from '../../analyze/publint.js';
import {LocalFileSystem} from '../../local-file-system.js';
import type {AnalysisContext} from '../../types.js';

function makeContext(root: string): AnalysisContext {
  return {
    fs: new LocalFileSystem(root),
    root,
    messages: [],
    stats: {
      name: 'test-package',
      version: '1.0.0',
      dependencyCount: {production: 0, development: 0},
      extraStats: []
    },
    lockfile: {
      type: 'npm',
      packages: [],
      root: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    },
    packageFile: {
      name: 'test-package',
      version: '1.0.0'
    }
  };
}

describe('runPublint', () => {
  it('groups per-file format warnings into a single message', async () => {
    const fixture = path.join(__dirname, '../../../test/fixtures/lazy-esm-cjs');

    const result = await runPublint(makeContext(fixture));

    const formatMessages = result.messages.filter((m) =>
      m.message.includes('are interpreted as')
    );

    expect(formatMessages).toHaveLength(1);
    expect(formatMessages[0]?.severity).toBe('warning');
    expect(formatMessages[0]?.message).toBe(
      '4 files are written in ESM, but are interpreted as CJS. Consider using the .mjs extension.'
    );
  });
});
