import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {LocalFileSystem} from '../local-file-system.js';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackageWithDependencies,
  type TestPackage
} from './utils.js';
import type {AnalysisContext} from '../types.js';
import {runDuplicateDependencyAnalysis} from '../analyze/duplicate-dependencies.js';
import {ParsedDependency} from 'lockparse';

describe('Duplicate Dependency Detection', () => {
  let tempDir: string;
  let fileSystem: LocalFileSystem;
  let context: AnalysisContext;

  beforeEach(async () => {
    tempDir = await createTempDir();
    fileSystem = new LocalFileSystem(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should detect multiple versions', async () => {
    const sharedLibv1: ParsedDependency = {
      name: 'shared-lib',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const sharedLibv2: ParsedDependency = {
      name: 'shared-lib',
      version: '2.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    const packageA: ParsedDependency = {
      name: 'package-a',
      version: '1.0.0',
      dependencies: [sharedLibv1],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    const packageB: ParsedDependency = {
      name: 'package-b',
      version: '1.0.0',
      dependencies: [sharedLibv2],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    const packageC: ParsedDependency = {
      name: 'package-c',
      version: '1.0.0',
      dependencies: [sharedLibv1],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    const testPkg: ParsedDependency = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: [packageA, packageB, packageC],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    //set the context
    context = {
      fs: fileSystem,
      root: '.',
      messages: [],
      stats: {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: {
          production: 0,
          development: 0,
          esm: 0,
          cjs: 0
        },
        extraStats: []
      },
      lockfile: {
        type: 'npm',
        packages: [
          testPkg,
          packageA,
          packageB,
          packageC,
          sharedLibv1,
          sharedLibv2
        ],
        root: {
          name: 'root-package',
          version: '1.0.0',
          dependencies: [testPkg],
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

    const stats = await runDuplicateDependencyAnalysis(context);

    expect(stats).toMatchSnapshot();
  });

  it('should not detect duplicates when there are none', async () => {
    const sharedLibv1: ParsedDependency = {
      name: 'shared-lib',
      version: '1.0.0',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };

    const packageA: ParsedDependency = {
      name: 'package-a',
      version: '1.0.0',
      dependencies: [sharedLibv1],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    const packageB: ParsedDependency = {
      name: 'package-b',
      version: '1.0.0',
      dependencies: [sharedLibv1],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    const testPkg: ParsedDependency = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: [packageA, packageB],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: []
    };
    //set the context
    context = {
      fs: fileSystem,
      root: '.',
      messages: [],
      stats: {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: {
          production: 0,
          development: 0,
          esm: 0,
          cjs: 0
        },
        extraStats: []
      },
      lockfile: {
        type: 'npm',
        packages: [testPkg, packageA, packageB, sharedLibv1],
        root: {
          name: 'root-package',
          version: '1.0.0',
          dependencies: [testPkg],
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

    const stats = await runDuplicateDependencyAnalysis(context);

    expect(stats).toMatchSnapshot();
  });
});
