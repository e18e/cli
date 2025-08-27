import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  createTempDir,
  cleanupTempDir,
  runCliProcess,
  stripVersion
} from './utils.js';

let tempDir: string;

beforeAll(async () => {
  // Create a temporary directory for the test
  tempDir = await createTempDir();

  // Copy the basic-chalk fixture to the temp dir
  const fixturePath = path.join(process.cwd(), 'test/fixtures/basic-chalk');
  await fs.cp(fixturePath, tempDir, {recursive: true});
});

afterAll(async () => {
  await cleanupTempDir(tempDir);
});

describe('migrate command', () => {
  it('should handle --all flag correctly', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--all', '--dry-run'],
      tempDir
    );

    if (code !== 0) {
      console.error('CLI Error:', stderr);
    }

    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(stderr).toBe('');
  });

  it('should handle specific package migration', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', 'chalk', '--dry-run'],
      tempDir
    );

    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(stderr).toBe('');
  });

  it('should handle interactive mode', async () => {
    // Test interactive mode by providing input to the prompt
    // Press Enter to accept the default selection
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', '--interactive', 'chalk', '--dry-run'],
      tempDir,
      '\n' // Press Enter to accept default
    );

    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(stderr).toBe('');
  });

  it('should handle custom include pattern', async () => {
    const {stdout, stderr, code} = await runCliProcess(
      ['migrate', 'chalk', '--include', '**/*.js', '--dry-run'],
      tempDir
    );

    expect(code).toBe(0);
    expect(stripVersion(stdout)).toMatchSnapshot();
    expect(stderr).toBe('');
  });
});
