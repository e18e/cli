import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runWebFeaturesCodemodsAnalysis} from '../../analyze/web-features-codemods.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {
  createTempDir,
  cleanupTempDir,
  testResolvedRuntimeTarget
} from '../utils.js';
import type {AnalysisContext, PackageJsonLike} from '../../types.js';

function makeContext(
  tempDir: string,
  overrides: Partial<AnalysisContext> = {}
): AnalysisContext {
  const {
    resolvedRuntimeTarget: rtOverride,
    packageFile: pkgOverride,
    options: optionsOverride,
    fs: fsOverride,
    root: rootOverride,
    messages: messagesOverride,
    stats: statsOverride,
    lockfile: lockfileOverride,
    ...rest
  } = overrides;

  const packageFile = (pkgOverride ?? {
    name: 'test-package',
    version: '1.0.0'
  }) as PackageJsonLike;
  const root = rootOverride ?? tempDir;
  const resolvedRuntimeTarget =
    rtOverride ??
    testResolvedRuntimeTarget(root, packageFile, {
      runtime: optionsOverride?.runtime,
      browserslistQuery: optionsOverride?.browserslistQuery
    });

  return {
    fs: fsOverride ?? new LocalFileSystem(root),
    root,
    messages: messagesOverride ?? [],
    stats: statsOverride ?? {
      name: 'test-package',
      version: '1.0.0',
      dependencyCount: {production: 0, development: 0},
      extraStats: []
    },
    lockfile: lockfileOverride ?? {
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
    packageFile,
    options: optionsOverride,
    resolvedRuntimeTarget,
    ...rest
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

  it('handles multiple occurrences of the same match in one file', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      [
        'const lastItem = items[items.length - 1];',
        'const lastValue = values[values.length - 1];'
      ].join('\n')
    );

    const {messages} = await runWebFeaturesCodemodsAnalysis(
      makeContext(tempDir)
    );

    expect(messages).toMatchSnapshot();
  });

  it('respects the src option', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), {recursive: true});
    await fs.mkdir(path.join(tempDir, 'other'), {recursive: true});
    await fs.writeFile(
      path.join(tempDir, 'src', 'index.js'),
      'const last = items[items.length - 1];\n'
    );
    await fs.writeFile(
      path.join(tempDir, 'other', 'index.js'),
      'const last = values[values.length - 1];\n'
    );

    const {messages} = await runWebFeaturesCodemodsAnalysis(
      makeContext(tempDir, {options: {src: ['src/**/*.js']}})
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
