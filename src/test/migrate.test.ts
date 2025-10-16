import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  createTempDir,
  cleanupTempDir,
  runCliProcess,
  stripVersion
} from './utils.js';

describe('migrate command', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await createTempDir();

    // Copy the basic-chalk fixture to the temp dir
    const fixturePath = path.join(process.cwd(), 'test/fixtures/basic-chalk');
    await fs.cp(fixturePath, tempDir, {recursive: true});
  });

  afterEach(async () => {
    // Clean up the temporary directory after each test
    await cleanupTempDir(tempDir);
  });
  it('should migrate with --all flag', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--all'],
      tempDir
    );

    expect(code).toBe(0);
    expect(await stripVersion(stdout, tempDir)).toMatchSnapshot();
    expect(stderr).toBe('');

    // Check that the file was actually modified (chalk import should be replaced with picocolors)
    const mainJsPath = path.join(tempDir, 'lib/main.js');
    const fileContent = await fs.readFile(mainJsPath, 'utf-8');
    expect(fileContent).toMatchSnapshot();
  });

  it('should migrate specific package', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', 'chalk'],
      tempDir
    );

    expect(code).toBe(0);
    expect(await stripVersion(stdout, tempDir)).toMatchSnapshot();
    expect(stderr).toBe('');

    // Check that the file was actually modified (chalk import should be replaced with picocolors)
    const mainJsPath = path.join(tempDir, 'lib/main.js');
    const fileContent = await fs.readFile(mainJsPath, 'utf-8');
    expect(fileContent).toMatchSnapshot();
  });

  it('should handle interactive mode', async () => {
    // Test interactive mode by providing input to the prompt
    // Press Enter to accept the default selection
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--all', '--interactive'],
      tempDir,
      '\n' // Press Enter to accept default
    );

    expect(code).toBe(0);
    expect(await stripVersion(stdout, tempDir)).toMatchSnapshot();
    expect(stderr).toBe('');

    // Check that the file was actually modified
    const mainJsPath = path.join(tempDir, 'lib/main.js');
    const fileContent = await fs.readFile(mainJsPath, 'utf-8');
    expect(fileContent).toMatchSnapshot();
  });

  it('should handle custom include pattern', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', 'chalk', '--include', '**/*.js'],
      tempDir
    );

    expect(code).toBe(0);
    expect(await stripVersion(stdout, tempDir)).toMatchSnapshot();
    expect(stderr).toBe('');

    // Check that the file was actually modified
    const mainJsPath = path.join(tempDir, 'lib/main.js');
    const fileContent = await fs.readFile(mainJsPath, 'utf-8');
    expect(fileContent).toMatchSnapshot();
  });

  it('should not modify files with --all flag in dry-run mode', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--all', '--dry-run'],
      tempDir
    );

    expect(code).toBe(0);
    expect(await stripVersion(stdout, tempDir)).toMatchSnapshot();
    expect(stderr).toBe('');

    // Check that the file was NOT modified in dry-run mode
    const mainJsPath = path.join(tempDir, 'lib/main.js');
    const fileContent = await fs.readFile(mainJsPath, 'utf-8');
    expect(fileContent).toMatchSnapshot();
  });

  it('should not modify files with specific package in dry-run mode', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', 'chalk', '--dry-run'],
      tempDir
    );

    expect(code).toBe(0);
    expect(await stripVersion(stdout, tempDir)).toMatchSnapshot();
    expect(stderr).toBe('');

    // Check that the file was NOT modified in dry-run mode
    const mainJsPath = path.join(tempDir, 'lib/main.js');
    const fileContent = await fs.readFile(mainJsPath, 'utf-8');
    expect(fileContent).toMatchSnapshot();
  });
});
