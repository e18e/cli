import {describe, it, expect, beforeAll, afterAll, afterEach} from 'vitest';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackage,
  createTestPackageWithDependencies
} from './utils.js';

let tempDir: string;
let fixableTempDir: string;
const stripVersion = (str: string): string =>
  str.replace(
    new RegExp(/\(cli v\d+\.\d+\.\d+(?:-\S+)?\)/, 'g'),
    '(cli <version>)'
  );

const normalizeStderr = (str: string): string =>
  str.replace(/\(node:\d+\)/g, '(node:<pid>)');

const basicChalkFixture = path.join(
  __dirname,
  '../../test/fixtures/basic-chalk'
);

beforeAll(async () => {
  // Create temp dir for mock package (no fixable replacements)
  tempDir = await createTempDir();
  await createTestPackage(tempDir, {
    name: 'mock-package',
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: {
      'some-dep': '1.0.0'
    }
  });
  await fs.writeFile(
    path.join(tempDir, 'index.js'),
    'console.log("Hello, world!");'
  );
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

  // Create temp dir for fixable replacements (chalk)
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
  await cleanupTempDir(tempDir);
  await cleanupTempDir(fixableTempDir);
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
    const {stdout, stderr, code} = await runCliProcess(
      ['analyze', '--log-level=debug'],
      tempDir
    );
    if (code !== 0) {
      console.error('CLI Error:', stderr);
    }
    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(normalizeStderr(stderr)).toMatchSnapshot();
  });

  it('should display package report', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['analyze', '--log-level=debug'],
      tempDir
    );
    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(normalizeStderr(stderr)).toMatchSnapshot();
  });
});

describe('analyze exit codes', () => {
  beforeAll(async () => {
    const nodeModules = path.join(basicChalkFixture, 'node_modules');
    if (!existsSync(nodeModules)) {
      execSync('npm install', {cwd: basicChalkFixture, stdio: 'pipe'});
    }
  });

  it('exits 1 when path is not a directory', async () => {
    const {code} = await runCliProcess(['analyze', '/nonexistent-path']);
    expect(code).toBe(1);
  });

  it('exits 0 with --log-level=debug', async () => {
    const {code} = await runCliProcess(
      ['analyze', '--log-level=debug'],
      tempDir
    );
    expect(code).toBe(0);
  });

  it('exits 1 with default log-level when analysis has messages', async () => {
    const {code} = await runCliProcess(['analyze'], basicChalkFixture);
    expect(code).toBe(1);
  });

  it('exits 0 with --log-level=debug when analysis has messages', async () => {
    const {code} = await runCliProcess(
      ['analyze', '--log-level=debug'],
      basicChalkFixture
    );
    expect(code).toBe(0);
  });
});

describe('analyze --json', () => {
  beforeAll(async () => {
    const nodeModules = path.join(basicChalkFixture, 'node_modules');
    if (!existsSync(nodeModules)) {
      execSync('npm install', {cwd: basicChalkFixture, stdio: 'pipe'});
    }
  });

  afterEach(async () => {
    await fs.rm(path.join(tempDir, 'e18e-cli-results.json'), {force: true});
    await fs.rm(path.join(basicChalkFixture, 'e18e-cli-results.json'), {
      force: true
    });
  });

  it('writes valid JSON to e18e-cli-results.json', async () => {
    const {code} = await runCliProcess(
      ['analyze', '--json', '--log-level=error'],
      tempDir
    );
    expect(code).toBe(0);
    const outputFile = path.join(tempDir, 'e18e-cli-results.json');
    const parsed = JSON.parse(await fs.readFile(outputFile, 'utf8'));
    expect(parsed).toHaveProperty('stats');
    expect(parsed).toHaveProperty('messages');
    expect(parsed.stats).toHaveProperty('name', 'mock-package');
    expect(parsed.stats).toHaveProperty('version', '1.0.0');
    expect(parsed.stats).toHaveProperty('dependencyCount');
    expect(Array.isArray(parsed.messages)).toBe(true);
  });

  it('exits 1 with --json when messages meet fail threshold', async () => {
    const {code} = await runCliProcess(
      ['analyze', '--json'],
      basicChalkFixture
    );
    expect(code).toBe(1);
    const outputFile = path.join(basicChalkFixture, 'e18e-cli-results.json');
    const parsed = JSON.parse(await fs.readFile(outputFile, 'utf8'));
    expect(parsed.messages.length).toBeGreaterThan(0);
  });
});

describe('analyze fixable summary', () => {
  it('includes fixable-by-migrate summary when project has fixable replacement', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['analyze', '--log-level=debug'],
      fixableTempDir
    );
    const output = stdout + stderr;
    expect(code).toBe(0);
    expect(output).toContain('fixable by');
    expect(output).toContain('npx @e18e/cli migrate');
  });
});

describe('migrate --all', () => {
  beforeAll(async () => {
    const nodeModules = path.join(basicChalkFixture, 'node_modules');
    if (!existsSync(nodeModules)) {
      execSync('npm install', {cwd: basicChalkFixture, stdio: 'pipe'});
    }
  });

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
