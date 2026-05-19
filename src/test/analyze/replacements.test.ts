import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runReplacements} from '../../analyze/replacements.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {createTempDir, cleanupTempDir} from '../utils.js';
import type {AnalysisContext, PackageJsonLike} from '../../types.js';

const MANIFEST = {
  mappings: {
    'legacy-pkg': {
      type: 'module',
      moduleName: 'legacy-pkg',
      replacements: ['legacy-native']
    },
    'old-browser-pkg': {
      type: 'module',
      moduleName: 'old-browser-pkg',
      replacements: ['modern-browser-native']
    }
  },
  replacements: {
    'legacy-native': {
      id: 'legacy-native',
      type: 'simple',
      description: 'use the native equivalent',
      engines: [{engine: 'nodejs', minVersion: '20.0.0'}]
    },
    'modern-browser-native': {
      id: 'modern-browser-native',
      type: 'simple',
      description: 'use the native browser API',
      engines: [{engine: 'chrome', minVersion: '100.0.0'}]
    }
  }
};

async function writeManifest(root: string): Promise<string> {
  const manifestPath = path.join(root, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(MANIFEST));
  return manifestPath;
}

async function setupContext(
  root: string,
  packageFile: PackageJsonLike,
  manifestPath: string
): Promise<AnalysisContext> {
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(packageFile)
  );
  return makeContext(root, packageFile, manifestPath);
}

function makeContext(
  root: string,
  packageFile: PackageJsonLike,
  manifestPath: string
): AnalysisContext {
  return {
    fs: new LocalFileSystem(root),
    root,
    messages: [],
    stats: {
      name: packageFile.name,
      version: packageFile.version,
      dependencyCount: {production: 0, development: 0},
      extraStats: []
    },
    lockfile: {
      type: 'npm',
      packages: [],
      root: {
        name: packageFile.name,
        version: packageFile.version,
        dependencies: [],
        devDependencies: [],
        optionalDependencies: [],
        peerDependencies: []
      }
    },
    packageFile,
    options: {manifest: [manifestPath]}
  };
}

describe('runReplacements engine filtering', () => {
  let tempDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    manifestPath = await writeManifest(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('emits a replacement when engines.node satisfies the requirement', async () => {
    const pkg: PackageJsonLike = {
      name: 'test-pkg',
      version: '1.0.0',
      dependencies: {'legacy-pkg': '1.0.0'},
      engines: {node: '>=20'}
    };
    const result = await runReplacements(
      await setupContext(tempDir, pkg, manifestPath)
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.message).toContain('legacy-pkg');
  });

  it('filters out a replacement when engines.node does not satisfy the requirement', async () => {
    const pkg: PackageJsonLike = {
      name: 'test-pkg',
      version: '1.0.0',
      dependencies: {'legacy-pkg': '1.0.0'},
      engines: {node: '>=16'}
    };
    const result = await runReplacements(
      await setupContext(tempDir, pkg, manifestPath)
    );

    expect(result.messages).toEqual([]);
  });

  it('emits a replacement when no engines are declared (constraint trivially satisfied)', async () => {
    const pkg: PackageJsonLike = {
      name: 'test-pkg',
      version: '1.0.0',
      dependencies: {'legacy-pkg': '1.0.0'}
    };
    const result = await runReplacements(
      await setupContext(tempDir, pkg, manifestPath)
    );

    expect(result.messages).toHaveLength(1);
  });

  it('discovers .browserslistrc from cwd to filter a replacement', async () => {
    await fs.writeFile(
      path.join(tempDir, '.browserslistrc'),
      'chrome >= 110\n'
    );

    const pkg: PackageJsonLike = {
      name: 'test-pkg',
      version: '1.0.0',
      dependencies: {'old-browser-pkg': '1.0.0'}
    };
    const result = await runReplacements(
      await setupContext(tempDir, pkg, manifestPath)
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.message).toContain('old-browser-pkg');
  });

  it('filters via .browserslistrc when the resolved browser version is too low', async () => {
    await fs.writeFile(path.join(tempDir, '.browserslistrc'), 'chrome >= 90\n');

    const pkg: PackageJsonLike = {
      name: 'test-pkg',
      version: '1.0.0',
      dependencies: {'old-browser-pkg': '1.0.0'}
    };
    const result = await runReplacements(
      await setupContext(tempDir, pkg, manifestPath)
    );

    expect(result.messages).toEqual([]);
  });

  it('uses package.json browserslist field to filter a replacement', async () => {
    const pkg: PackageJsonLike = {
      name: 'test-pkg',
      version: '1.0.0',
      dependencies: {'old-browser-pkg': '1.0.0'},
      browserslist: ['chrome >= 90']
    };
    const result = await runReplacements(
      await setupContext(tempDir, pkg, manifestPath)
    );

    expect(result.messages).toEqual([]);
  });
});
