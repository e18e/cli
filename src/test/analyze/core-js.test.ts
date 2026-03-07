import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  runCoreJsAnalysis,
  runVendoredCoreJsAnalysis
} from '../../analyze/core-js.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {createTempDir, cleanupTempDir} from '../utils.js';
import type {AnalysisContext} from '../../types.js';

const cjsRequire = createRequire(import.meta.url);
const {compat} = cjsRequire('core-js-compat') as {
  compat: (opts: {targets: Record<string, string>; inverse?: boolean}) => {
    list: string[];
  };
};

const unnecessaryForNode18 = compat({
  targets: {node: '18.0.0'},
  inverse: true
}).list;
const unnecessaryModule = unnecessaryForNode18[0]!;

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

describe('runCoreJsAnalysis', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('skips when core-js is not in dependencies', async () => {
    const context = makeContext(tempDir, {
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
  });

  it('skips when only core-js-pure is absent but unrelated deps exist', async () => {
    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {lodash: '4.0.0'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
  });

  it('warns on broad core-js import', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), `import 'core-js';\n`);

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.severity).toBe('warning');
    expect(result.messages[0]!.message).toContain('"core-js"');
  });

  it('warns on all broad import variants', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      [
        `import 'core-js';`,
        `import 'core-js/stable';`,
        `import 'core-js/actual';`,
        `import 'core-js/full';`
      ].join('\n')
    );

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(4);
    expect(result.messages.every((m) => m.severity === 'warning')).toBe(true);
  });

  it('suggests when a specific module is unnecessary for the node target', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      `import 'core-js/modules/${unnecessaryModule}';\n`
    );

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'},
        engines: {node: '>=18'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.severity).toBe('suggestion');
    expect(result.messages[0]!.message).toContain(unnecessaryModule);
  });

  it('emits no message for a require() broad import', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), `require('core-js');\n`);

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.severity).toBe('warning');
  });

  it('emits no message for a core-js/modules import that is still needed', async () => {
    const necessaryModules = compat({
      targets: {node: '0.10.0'},
      inverse: true
    }).list;
    const necessaryForOldNode = unnecessaryForNode18.filter(
      (m) => !necessaryModules.includes(m)
    );

    if (necessaryForOldNode.length === 0) {
      return;
    }

    const neededModule = necessaryForOldNode[0]!;

    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      `import 'core-js/modules/${neededModule}';\n`
    );

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'},
        engines: {node: '>=0.10'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
  });

  it('detects core-js in devDependencies', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), `import 'core-js';\n`);

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        devDependencies: {'core-js': '^3.0.0'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
  });

  it('detects core-js-pure in dependencies', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.ts'),
      `import 'core-js/modules/${unnecessaryModule}';\n`
    );

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js-pure': '^3.0.0'},
        engines: {node: '>=18'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.severity).toBe('suggestion');
  });

  it('falls back to current node version when engines.node is absent', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), `import 'core-js';\n`);

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'}
      }
    });

    await expect(runCoreJsAnalysis(context)).resolves.not.toThrow();
  });

  it('ignores files in excluded directories', async () => {
    for (const dir of ['node_modules', 'dist', 'build', 'coverage', 'lib']) {
      await fs.mkdir(path.join(tempDir, dir), {recursive: true});
      await fs.writeFile(
        path.join(tempDir, dir, 'index.js'),
        `import 'core-js';\n`
      );
    }

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'}
      }
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
  });
});

describe('runVendoredCoreJsAnalysis', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('skips when buildDir is not set', async () => {
    const context = makeContext(tempDir);

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
    expect(result.stats).toBeUndefined();
  });

  it('skips when buildDir option is explicitly undefined', async () => {
    const context = makeContext(tempDir, {options: {buildDir: undefined}});

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
  });

  it('returns no messages when build dir has no vendored core-js', async () => {
    const buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(buildDir);
    await fs.writeFile(
      path.join(buildDir, 'bundle.js'),
      `console.log('hello world');\n`
    );

    const context = makeContext(tempDir, {
      options: {buildDir: 'dist'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
    expect(result.stats).toBeUndefined();
  });

  it('warns when a vendored core-js file is detected via Denis Pushkarev', async () => {
    const buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(buildDir);
    await fs.writeFile(
      path.join(buildDir, 'bundle.js'),
      `/* Denis Pushkarev */ var e={version:"3.35.0"};`
    );

    const context = makeContext(tempDir, {
      options: {buildDir: 'dist'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.severity).toBe('warning');
    expect(result.messages[0]!.message).toContain('3.35.0');
    expect(result.messages[0]!.message).toContain('dist/bundle.js');
  });

  it('warns when a vendored core-js file is detected via zloirock', async () => {
    const buildDir = path.join(tempDir, '.next');
    await fs.mkdir(buildDir, {recursive: true});
    await fs.writeFile(
      path.join(buildDir, 'chunks.js'),
      `/* zloirock */ var e={version:"3.30.0"};`
    );

    const context = makeContext(tempDir, {
      options: {buildDir: '.next'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.message).toContain('3.30.0');
  });

  it('reports vendoredPolyfillSize in stats', async () => {
    const buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(buildDir);
    const content = `/* Denis Pushkarev */ var e={version:"3.35.0"};`;
    await fs.writeFile(path.join(buildDir, 'bundle.js'), content);

    const fileSize = Buffer.byteLength(content, 'utf8');

    const context = makeContext(tempDir, {
      options: {buildDir: 'dist'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.stats?.extraStats).toHaveLength(1);
    expect(result.stats?.extraStats![0]!.name).toBe('vendoredPolyfillSize');
    expect(result.stats?.extraStats![0]!.label).toBe('Vendored Polyfill Size');
    expect(result.stats?.extraStats![0]!.value).toBe(fileSize);
  });

  it('accumulates size across multiple vendored files', async () => {
    const buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(buildDir);
    const content = `/* Denis Pushkarev */ var e={version:"3.35.0"};`;
    await fs.writeFile(path.join(buildDir, 'a.js'), content);
    await fs.writeFile(path.join(buildDir, 'b.js'), content);

    const context = makeContext(tempDir, {
      options: {buildDir: 'dist'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(2);
    const totalSize = result.stats?.extraStats![0]!.value as number;
    expect(totalSize).toBe(Buffer.byteLength(content, 'utf8') * 2);
  });

  it('handles a missing build directory gracefully', async () => {
    const context = makeContext(tempDir, {
      options: {buildDir: 'nonexistent'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(0);
    expect(result.stats).toBeUndefined();
  });

  it('reports unknown version when version string is absent', async () => {
    const buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(buildDir);
    await fs.writeFile(
      path.join(buildDir, 'bundle.js'),
      `/* Denis Pushkarev - no version here */`
    );

    const context = makeContext(tempDir, {
      options: {buildDir: 'dist'},
      packageFile: {name: 'test-package', version: '1.0.0'}
    });

    const result = await runVendoredCoreJsAnalysis(context);

    expect(result.messages[0]!.message).toContain('unknown');
  });
});
