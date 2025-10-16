import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  createTempDir,
  cleanupTempDir,
  createTestPackage,
  runCliProcess,
  stripVersion
} from './utils.js';
import {pack as packAsTarball} from '@publint/pack';

let mockTarballPath: string;
let tempDir: string;

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

  // Pack the test package into a tarball (cross-platform, no external npm spawn)
  mockTarballPath = await packAsTarball(tempDir, {
    packageManager: 'npm',
    ignoreScripts: true,
    destination: tempDir
  });
});

afterAll(async () => {
  await cleanupTempDir(tempDir);
});

describe('CLI', () => {
  it('should run successfully with default options', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['analyze', mockTarballPath],
      tempDir
    );
    if (code !== 0) {
      console.error('CLI Error:', stderr);
    }
    expect(code).toBe(0);
    expect(await stripVersion(stdout, process.cwd())).toMatchSnapshot();
    expect(stderr).toBe('');
  });

  it('should display package report', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['analyze', mockTarballPath],
      tempDir
    );
    expect(code).toBe(0);
    expect(await stripVersion(stdout, process.cwd())).toMatchSnapshot();
    expect(stderr).toMatchSnapshot();
  });
});
