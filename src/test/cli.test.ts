import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackage,
  createTestPackageWithDependencies
} from './utils.js';

let tempDir: string;
const stripVersion = (str: string): string =>
  str.replace(
    new RegExp(/\(cli v\d+\.\d+\.\d+(?:-\S+)?\)/, 'g'),
    '(cli <version>)'
  );

const normalizeStderr = (str: string): string =>
  str.replace(/\(node:\d+\)/g, '(node:<pid>)');

beforeAll(async () => {
  // Create a temporary directory for the test package
  tempDir = await createTempDir();

  // Create a test package with some files
  await createTestPackage(tempDir, {
    name: 'mock-package',
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: {
      'some-dep': '1.0.0'
    }
  });

  // Create a simple index.js file
  await fs.writeFile(
    path.join(tempDir, 'index.js'),
    'console.log("Hello, world!");'
  );

  // Create node_modules with a dependency
  const nodeModules = path.join(tempDir, 'node_modules');
  await fs.mkdir(nodeModules, {recursive: true});
  await fs.mkdir(path.join(nodeModules, 'some-dep'), {recursive: true});
  await fs.writeFile(
    path.join(nodeModules, 'some-dep', 'package.json'),
    JSON.stringify({
      name: 'some-dep',
      version: '1.0.0',
      type: 'module'
    })
  );
});

afterAll(async () => {
  await cleanupTempDir(tempDir);
});

function runCliProcess(
  args: string[],
  cwd?: string
): Promise<{stdout: string; stderr: string; code: number | null}> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(__dirname, '../../lib/cli.js');
    const proc = spawn('node', [cliPath, ...args], {
      env: process.env,
      cwd: cwd || process.cwd()
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));
    proc.on('error', (err) => {
      stderr += String(err);
      resolve({stdout, stderr, code: 1});
    });
    proc.on('close', (code) => resolve({stdout, stderr, code}));
  });
}

describe('CLI', () => {
  it('should run successfully with default options', async () => {
    const {stdout, stderr, code} = await runCliProcess(['analyze'], tempDir);
    if (code !== 0) {
      console.error('CLI Error:', stderr);
    }
    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(normalizeStderr(stderr)).toMatchSnapshot();
  });

  it('should display package report', async () => {
    const {stdout, stderr, code} = await runCliProcess(['analyze'], tempDir);
    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(normalizeStderr(stderr)).toMatchSnapshot();
  });
});

let fixableTempDir: string;
const basicChalkFixture = path.join(
  __dirname,
  '../../test/fixtures/basic-chalk'
);

describe('analyze fixable summary', () => {
  beforeAll(async () => {
    fixableTempDir = await createTempDir();
    await createTestPackageWithDependencies(
      fixableTempDir,
      {
        name: 'foo',
        version: '0.0.1',
        type: 'module',
        main: 'lib/main.js',
        dependencies: {chalk: '^4.0.0'}
      },
      [{name: 'chalk', version: '4.1.2', type: 'module'}]
    );
  });

  afterAll(async () => {
    await cleanupTempDir(fixableTempDir);
  });

  it('includes fixable-by-migrate summary when project has fixable replacement', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['analyze'],
      fixableTempDir
    );
    const output = stdout + stderr;
    expect(code).toBe(0);
    expect(output).toContain('fixable by');
    expect(output).toContain('npx @e18e/cli migrate');
  });
});

describe('migrate --all', () => {
  it('should migrate all fixable replacements with --all --dry-run when project has fixable deps', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--all', '--dry-run'],
      basicChalkFixture
    );
    expect(code).toBe(0);
    const output = stdout + stderr;
    expect(output).toContain('Migration complete');
    expect(output).toContain('files migrated');
    expect(output).toContain('chalk');
  });

  it('should run to completion and show Migration complete when --all has no fixable replacements', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--all'],
      tempDir
    );
    const output = stdout + stderr;
    expect(code).toBe(0);
    expect(output).toContain('Migration complete');
    expect(output).toContain('0 files migrated');
  });
});
