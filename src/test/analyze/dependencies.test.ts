import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {runDependencyAnalysis} from '../../analyze/dependencies.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackage,
  createTestPackageWithDependencies,
  type TestPackage
} from '../utils.js';
import type {AnalysisContext} from '../../types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('analyzeDependencies (local)', () => {
  let tempDir: string;
  let fileSystem: LocalFileSystem;
  let context: AnalysisContext;

  beforeEach(async () => {
    tempDir = await createTempDir();
    fileSystem = new LocalFileSystem(tempDir);
    context = {
      fs: fileSystem,
      root: '.',
      messages: [],
      stats: {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: {
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

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should handle empty project', async () => {
    await createTestPackage(tempDir, {
      name: 'test-package',
      version: '1.0.0'
    });

    const stats = await runDependencyAnalysis(context);
    expect(stats).toMatchSnapshot();
  });

  it('should analyze dependencies correctly', async () => {
    const rootPackage: TestPackage = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'cjs-package': '1.0.0',
        'esm-package': '1.0.0'
      },
      devDependencies: {
        'dev-package': '1.0.0'
      }
    };

    const dependencies: TestPackage[] = [
      {
        name: 'cjs-package',
        version: '1.0.0',
        main: 'index.js',
        type: 'commonjs'
      },
      {
        name: 'esm-package',
        version: '1.0.0',
        type: 'module',
        exports: {
          '.': {
            import: './index.js'
          }
        }
      },
      {
        name: 'dev-package',
        version: '1.0.0',
        type: 'commonjs'
      }
    ];
    //update package json on context
    context.packageFile.dependencies = {
      'cjs-package': '1.0.0',
      'esm-package': '1.0.0'
    };
    context.packageFile.devDependencies = {'dev-package': '1.0.0'};

    await createTestPackageWithDependencies(tempDir, rootPackage, dependencies);

    const stats = await runDependencyAnalysis(context);
    expect(stats).toMatchSnapshot();
  });

  it('should handle symlinks', async () => {
    //update package json on context
    context.packageFile.dependencies = {
      'test-package': '1.0.0'
    };
    // Create root package
    await createTestPackage(
      tempDir,
      {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'linked-package': '1.0.0'
        }
      },
      {createNodeModules: true}
    );

    // Create a package that will be linked
    const realPkg = path.join(tempDir, 'real-package');
    await fs.mkdir(realPkg);
    await createTestPackage(realPkg, {
      name: 'linked-package',
      version: '1.0.0',
      type: 'module'
    });

    // Create a symlink to the real package
    await fs.symlink(
      realPkg,
      path.join(tempDir, 'node_modules', 'linked-package'),
      'dir'
    );

    const stats = await runDependencyAnalysis(context);
    expect(stats).toMatchSnapshot();
  });

  it('should handle circular dependencies without hanging', async () => {
    context.packageFile.dependencies = {
      'package-a': '1.0.0'
    };

    await createTestPackage(
      tempDir,
      {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'package-a': '1.0.0'
        }
      },
      {createNodeModules: true}
    );

    const nodeModules = path.join(tempDir, 'node_modules');

    // package-a depends on package-b
    const pkgADir = path.join(nodeModules, 'package-a');
    await fs.mkdir(pkgADir, {recursive: true});
    await fs.writeFile(
      path.join(pkgADir, 'package.json'),
      JSON.stringify({
        name: 'package-a',
        version: '1.0.0',
        dependencies: {'package-b': '1.0.0'}
      })
    );

    // package-b depends on package-a (circular)
    const pkgBDir = path.join(nodeModules, 'package-b');
    await fs.mkdir(pkgBDir, {recursive: true});
    await fs.writeFile(
      path.join(pkgBDir, 'package.json'),
      JSON.stringify({
        name: 'package-b',
        version: '1.0.0',
        dependencies: {'package-a': '1.0.0'}
      })
    );

    const result = await runDependencyAnalysis(context);
    expect(result.stats?.dependencyCount?.production).toBe(1);
  });

  it('should handle missing node_modules', async () => {
    //update package json on context
    context.packageFile.dependencies = {
      'test-package': '1.0.0'
    };
    await createTestPackage(tempDir, {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'some-package': '1.0.0'
      }
    });

    const stats = await runDependencyAnalysis(context);
    expect(stats).toMatchSnapshot();
  });
});
