import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runWebFeaturesCodemodsAnalysis} from '../../analyze/web-features-codemods.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {createTempDir, cleanupTempDir} from '../utils.js';
import type {AnalysisContext} from '../../types.js';

function makeContext(
  tempDir: string,
  overrides: Partial<AnalysisContext> = {}
): AnalysisContext {
  return {
    fs: new LocalFileSystem(tempDir),
    root: tempDir,
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
    },
    ...overrides
  };
}

describe('runWebFeaturesCodemodsAnalysis', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('handles a file with no matches', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'const value = 1;\n');

    const {messages} = await runWebFeaturesCodemodsAnalysis(
      makeContext(tempDir)
    );

    expect(messages).toMatchSnapshot();
  });

  it('handles a file with one match', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      'const last = items[items.length - 1];\n'
    );

    const {messages} = await runWebFeaturesCodemodsAnalysis(
      makeContext(tempDir)
    );

    expect(messages).toMatchSnapshot();
  });

  it('handles a file with multiple matches', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      [
        'const last = items[items.length - 1];',
        'const squared = Math.pow(value, 2);'
      ].join('\n')
    );

    const {messages} = await runWebFeaturesCodemodsAnalysis(
      makeContext(tempDir)
    );

    expect(messages).toMatchSnapshot();
  });

  it('ignores a file path outside of the root', async () => {
    const outsideDir = await createTempDir();
    try {
      await fs.writeFile(
        path.join(outsideDir, 'index.js'),
        'const last = items[items.length - 1];\n'
      );

      const outsidePattern = `../${path.basename(outsideDir)}/index.js`;
      const {messages} = await runWebFeaturesCodemodsAnalysis(
        makeContext(tempDir, {options: {src: [outsidePattern]}})
      );

      expect(messages).toMatchSnapshot();
    } finally {
      await cleanupTempDir(outsideDir);
    }
  });
});
