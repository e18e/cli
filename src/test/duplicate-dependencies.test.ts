import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {analyzeDependencies} from '../analyze/dependencies.js';
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

    const stats = await analyzeDependencies(fileSystem);

    expect(stats.duplicateDependencies).toEqual([
      {
        potentialSavings: 1,
        name: 'shared-lib',
        severity: 'exact',
        suggestions: [
          'Consider standardizing on version 2.0.0 (used by 2 dependencies)',
          'Check if newer versions of consuming packages (package-a, package-b) would resolve this duplicate'
        ],
        versions: [
          {
            name: 'shared-lib',
            version: '2.0.0',
            path: 'root > package-a > shared-lib',
            parent: 'package-a',
            depth: 2,
            packagePath: expect.any(String)
          },
          {
            name: 'shared-lib',
            version: '2.0.0',
            path: 'root > package-b > shared-lib',
            parent: 'package-b',
            depth: 2,
            packagePath: expect.any(String)
          }
        ]
      }
    ]);
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

    const stats = await analyzeDependencies(fileSystem);

    expect(stats.duplicateDependencies).toEqual([
      {
        name: 'shared-lib',
        potentialSavings: 2,
        severity: 'conflict',
        suggestions: [
          'Consider standardizing on version 1.0.0 (used by 2 dependencies)',
          'Check if newer versions of consuming packages (package-a, package-b) would resolve this duplicate'
        ],
        versions: [
          {
            name: 'shared-lib',
            packagePath: expect.any(String),
            depth: 2,
            parent: 'package-a',
            path: 'root > package-a > shared-lib',
            version: '1.0.0'
          },
          {
            name: 'shared-lib',
            packagePath: expect.any(String),
            depth: 2,
            parent: 'package-b',
            path: 'root > package-b > shared-lib',
            version: '1.0.0'
          },
          {
            name: 'shared-lib',
            packagePath: expect.any(String),
            depth: 2,
            parent: 'package-b',
            path: 'shared-lib',
            version: '2.0.0'
          }
        ]
      }
    ]);
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

    const stats = await analyzeDependencies(fileSystem);

    expect(stats.duplicateDependencies).toBeUndefined();
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

    const stats = await analyzeDependencies(fileSystem);

    expect(stats.duplicateDependencies).toEqual([
      {
        name: 'shared-lib',
        potentialSavings: 1,
        severity: 'exact',
        suggestions: [
          'Consider standardizing on version 2.0.0 (used by 2 dependencies)',
          'Check if newer versions of consuming packages (package-a, package-b) would resolve this duplicate'
        ],
        versions: [
          {
            depth: 2,
            name: 'shared-lib',
            packagePath: expect.any(String),
            parent: 'package-a',
            path: 'root > package-a > shared-lib',
            version: '2.0.0'
          },
          {
            depth: 2,
            name: 'shared-lib',
            packagePath: expect.any(String),
            parent: 'package-b',
            path: 'root > package-b > shared-lib',
            version: '2.0.0'
          }
        ]
      }
    ]);
  });
});
