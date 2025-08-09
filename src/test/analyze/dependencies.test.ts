import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {runDependencyAnalysis} from '../../analyze/dependencies.js';
import {TarballFileSystem} from '../../tarball-file-system.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackage,
  createTestPackageWithDependencies,
  type TestPackage
} from '../utils.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../test/fixtures'
);

// Integration test using a real tarball fixture

describe('analyzeDependencies (tarball)', () => {
  it('should analyze a real tarball fixture', async () => {
    const tarballPath = path.join(FIXTURE_DIR, 'test-package.tgz');
    const tarballBuffer = await fs.readFile(tarballPath);
    const fileSystem = new TarballFileSystem(
      tarballBuffer.buffer as ArrayBuffer
    );
    const result = await runDependencyAnalysis(fileSystem);
    expect(result).toMatchSnapshot();
  });
});

describe('analyzeDependencies (local)', () => {
  let tempDir: string;
  let fileSystem: LocalFileSystem;

  beforeEach(async () => {
    tempDir = await createTempDir();
    fileSystem = new LocalFileSystem(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should handle empty project', async () => {
    await createTestPackage(tempDir, {
      name: 'test-package',
      version: '1.0.0'
    });

    const stats = await runDependencyAnalysis(fileSystem);
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

    await createTestPackageWithDependencies(tempDir, rootPackage, dependencies);

    const stats = await runDependencyAnalysis(fileSystem);
    expect(stats).toMatchSnapshot();
  });

  it('should handle symlinks', async () => {
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

    const stats = await runDependencyAnalysis(fileSystem);
    expect(stats).toMatchSnapshot();
  });

  it('should handle missing node_modules', async () => {
    await createTestPackage(tempDir, {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'some-package': '1.0.0'
      }
    });

    const stats = await runDependencyAnalysis(fileSystem);
    expect(stats).toMatchSnapshot();
  });
});
