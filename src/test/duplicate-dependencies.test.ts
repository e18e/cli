import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {runDependencyAnalysis} from '../analyze/dependencies.js';
import {LocalFileSystem} from '../local-file-system.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackage,
  createTestPackageWithDependencies,
  type TestPackage
} from './utils.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Duplicate Dependency Detection', () => {
  let tempDir: string;
  let fileSystem: LocalFileSystem;

  beforeEach(async () => {
    tempDir = await createTempDir();
    fileSystem = new LocalFileSystem(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should detect exact duplicate dependencies', async () => {
    const rootPackage: TestPackage = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'package-a': '1.0.0',
        'package-b': '1.0.0'
      }
    };

    const dependencies: TestPackage[] = [
      {
        name: 'package-a',
        version: '1.0.0',
        dependencies: {
          'shared-lib': '2.0.0'
        }
      },
      {
        name: 'package-b',
        version: '1.0.0',
        dependencies: {
          'shared-lib': '2.0.0'
        }
      },
      {
        name: 'shared-lib',
        version: '2.0.0'
      }
    ];

    await createTestPackageWithDependencies(tempDir, rootPackage, dependencies);

    const stats = await runDependencyAnalysis(fileSystem);

    expect(stats).toMatchSnapshot();
  });

  it('should detect version conflicts', async () => {
    const rootPackage: TestPackage = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'package-a': '1.0.0',
        'package-b': '1.0.0'
      }
    };

    // Create root package
    await createTestPackage(tempDir, rootPackage, {createNodeModules: true});

    // Create package-a with shared-lib v1.0.0
    const packageADir = path.join(tempDir, 'node_modules', 'package-a');
    await fs.mkdir(packageADir);
    await createTestPackage(packageADir, {
      name: 'package-a',
      version: '1.0.0',
      dependencies: {
        'shared-lib': '1.0.0'
      }
    });

    // Create package-b with shared-lib v2.0.0
    const packageBDir = path.join(tempDir, 'node_modules', 'package-b');
    await fs.mkdir(packageBDir);
    await createTestPackage(packageBDir, {
      name: 'package-b',
      version: '1.0.0',
      dependencies: {
        'shared-lib': '2.0.0'
      }
    });

    // Create shared-lib v1.0.0
    const sharedLibV1Dir = path.join(tempDir, 'node_modules', 'shared-lib');
    await fs.mkdir(sharedLibV1Dir);
    await createTestPackage(sharedLibV1Dir, {
      name: 'shared-lib',
      version: '1.0.0'
    });

    // Create shared-lib v2.0.0 in a nested location
    const sharedLibV2Dir = path.join(
      tempDir,
      'node_modules',
      'package-b',
      'node_modules',
      'shared-lib'
    );
    await fs.mkdir(sharedLibV2Dir, {recursive: true});
    await createTestPackage(sharedLibV2Dir, {
      name: 'shared-lib',
      version: '2.0.0'
    });

    const stats = await runDependencyAnalysis(fileSystem);

    expect(stats).toMatchSnapshot();
  });

  it('should not detect duplicates when there are none', async () => {
    const rootPackage: TestPackage = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'package-a': '1.0.0'
      }
    };

    const dependencies: TestPackage[] = [
      {
        name: 'package-a',
        version: '1.0.0'
      }
    ];

    await createTestPackageWithDependencies(tempDir, rootPackage, dependencies);

    const stats = await runDependencyAnalysis(fileSystem);

    expect(stats).toMatchSnapshot();
  });

  it('should generate suggestions for duplicates', async () => {
    const rootPackage: TestPackage = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'package-a': '1.0.0',
        'package-b': '1.0.0'
      }
    };

    const dependencies: TestPackage[] = [
      {
        name: 'package-a',
        version: '1.0.0',
        dependencies: {
          'shared-lib': '2.0.0'
        }
      },
      {
        name: 'package-b',
        version: '1.0.0',
        dependencies: {
          'shared-lib': '2.0.0'
        }
      },
      {
        name: 'shared-lib',
        version: '2.0.0'
      }
    ];

    await createTestPackageWithDependencies(tempDir, rootPackage, dependencies);

    const stats = await runDependencyAnalysis(fileSystem);

    expect(stats).toMatchSnapshot();
  });
});
