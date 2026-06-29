import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {LocalFileSystem} from '../local-file-system.js';
import {createTempDir, cleanupTempDir} from './utils.js';
import type {AnalysisContext} from '../types.js';
import {runDuplicateDependencyAnalysis} from '../analyze/duplicate-dependencies.js';
import {ParsedDependency, parse as parseLockfile} from 'lockparse';

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
          development: 0
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

  it('should exclude dev dependency parents when production flag is set', async () => {
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
    const devPkg: ParsedDependency = {
      name: 'dev-only-pkg',
      version: '1.0.0',
      dependencies: [sharedLibv2],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: []
    };
    const testPkg: ParsedDependency = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: [packageA],
      devDependencies: [devPkg],
      optionalDependencies: [],
      peerDependencies: []
    };

    context = {
      fs: fileSystem,
      root: '.',
      messages: [],
      stats: {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: {production: 0, development: 0},
        extraStats: []
      },
      options: {production: true},
      lockfile: {
        type: 'npm',
        packages: [testPkg, packageA, devPkg, sharedLibv1, sharedLibv2],
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

    const result = await runDuplicateDependencyAnalysis(context);
    // shared-lib@2.0.0 is only reachable via dev deps, so with --production
    // only shared-lib@1.0.0 is seen and no duplicate is reported at all
    expect(result.messages).toHaveLength(0);
  });

  it('should exclude dev-only duplicates when production flag is set (real lockfile)', async () => {
    const lockfileContent = JSON.stringify({
      name: 'root-package',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'root-package',
          version: '1.0.0',
          dependencies: {'package-a': '^1.0.0'},
          devDependencies: {'dev-only-pkg': '^1.0.0'}
        },
        'node_modules/package-a': {
          version: '1.0.0',
          dependencies: {'shared-lib': '^1.0.0'}
        },
        'node_modules/package-a/node_modules/shared-lib': {
          version: '1.0.0'
        },
        'node_modules/dev-only-pkg': {
          version: '1.0.0',
          dependencies: {'shared-lib': '^2.0.0'}
        },
        'node_modules/dev-only-pkg/node_modules/shared-lib': {
          version: '2.0.0'
        }
      }
    });

    const lockfile = await parseLockfile(
      lockfileContent,
      'package-lock.json',
      {name: 'root-package', version: '1.0.0'}
    );

    context = {
      fs: fileSystem,
      root: '.',
      messages: [],
      stats: {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: {production: 0, development: 0},
        extraStats: []
      },
      options: {production: true},
      lockfile,
      packageFile: {
        name: 'root-package',
        version: '1.0.0'
      }
    };

    const result = await runDuplicateDependencyAnalysis(context);
    // shared-lib@2.0.0 is only reachable via the dev-only dependency, so
    // with --production only shared-lib@1.0.0 is seen and no duplicate
    // is reported. This pins the contract between resolveDuplicateDependencies'
    // identity-based filtering and lockparse's actual object references.
    expect(result.messages).toHaveLength(0);
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
          development: 0
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
