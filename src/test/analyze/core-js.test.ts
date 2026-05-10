import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runCoreJsAnalysis} from '../../analyze/core-js.js';
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
const unnecessaryModule = unnecessaryForNode18[0];
if (!unnecessaryModule)
  throw new Error('core-js-compat returned empty list for node 18');

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
    const broadMsg = result.messages[0];
    expect(broadMsg).toBeDefined();
    expect(broadMsg?.severity).toBe('warning');
    expect(broadMsg?.message).toContain('"core-js"');
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
    const suggestionMsg = result.messages[0];
    expect(suggestionMsg).toBeDefined();
    expect(suggestionMsg?.severity).toBe('suggestion');
    expect(suggestionMsg?.message).toContain(unnecessaryModule);
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
    expect(result.messages[0]?.severity).toBe('warning');
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

    const neededModule = necessaryForOldNode[0];
    expect(neededModule).toBeDefined();
    if (!neededModule)
      throw new Error('necessaryForOldNode was unexpectedly empty');

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
    expect(result.messages[0]?.severity).toBe('suggestion');
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

  it('scans only specified src globs when options.src is provided', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), {recursive: true});
    await fs.mkdir(path.join(tempDir, 'other'), {recursive: true});
    await fs.writeFile(
      path.join(tempDir, 'src', 'index.js'),
      `import 'core-js';\n`
    );
    // This file is outside src/ and should NOT be scanned
    await fs.writeFile(
      path.join(tempDir, 'other', 'index.js'),
      `import 'core-js';\n`
    );

    const context = makeContext(tempDir, {
      packageFile: {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {'core-js': '^3.0.0'}
      },
      options: {src: ['src/**/*.js']}
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.message).toContain('src');
  });

  it('scans multiple src globs when options.src has more than one entry', async () => {
    for (const dir of ['src', 'app']) {
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
      },
      options: {src: ['src/**/*.js', 'app/**/*.js']}
    });

    const result = await runCoreJsAnalysis(context);

    expect(result.messages).toHaveLength(2);
  });
});
