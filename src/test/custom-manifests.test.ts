import {describe, it, expect, afterEach, vi, beforeEach} from 'vitest';
import {runReplacements} from '../analyze/replacements.js';
import {LocalFileSystem} from '../local-file-system.js';
import type {AnalysisContext} from '../types.js';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Custom Manifests', () => {
  let context: AnalysisContext;

  beforeEach(() => {
    const testDir = join(__dirname, '../../test/fixtures/fake-modules');
    const fileSystem = new LocalFileSystem(testDir);

    context = {
      fs: fileSystem,
      root: '.',
      messages: [],
      stats: {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: {
          cjs: 0,
          esm: 0,
          duplicate: 0,
          production: 0,
          development: 0
        },
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load and use custom manifest files', async () => {
    const customManifestPath = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );

    context.options = {
      manifest: [customManifestPath]
    };

    const result = await runReplacements(context);

    expect(result.messages).toMatchSnapshot();
  });

  it('should handle invalid manifest files gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invalidManifestPath = 'non-existent-file.json';

    context.options = {
      manifest: [invalidManifestPath]
    };

    const result = await runReplacements(context);

    expect(result.messages).toMatchSnapshot();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Warning: Failed to load custom manifest from ${invalidManifestPath}:`
      )
    );
  });

  it('should prioritize custom replacements over built-in ones', async () => {
    const customManifestPath = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );

    context.options = {
      manifest: [customManifestPath]
    };

    const resultWithCustom = await runReplacements(context);

    context.options = undefined;

    const resultWithoutCustom = await runReplacements(context);

    expect({
      withCustom: resultWithCustom.messages,
      withoutCustom: resultWithoutCustom.messages
    }).toMatchSnapshot();
  });

  it('should load multiple manifest files', async () => {
    const manifest1Path = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );
    const manifest2Path = join(
      __dirname,
      '../../test/fixtures/custom-manifest-2.json'
    );

    context.options = {
      manifest: [manifest1Path, manifest2Path]
    };

    const result = await runReplacements(context);

    expect(result.messages).toMatchSnapshot();
  });
});
