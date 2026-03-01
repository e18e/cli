import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {runPublint} from '../../analyze/publint.js';
import {TarballFileSystem} from '../../tarball-file-system.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {createTempDir, cleanupTempDir, createTestPackage} from '../utils.js';
import {pack as packAsTarball} from '@publint/pack';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('runPublint', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  async function createTarballFromPackage(
    packageData: any,
    files: Record<string, string> = {}
  ): Promise<ArrayBuffer> {
    await createTestPackage(tempDir, packageData);

    for (const [fileName, content] of Object.entries(files)) {
      await fs.writeFile(path.join(tempDir, fileName), content);
    }

    const tarballPath = await packAsTarball(tempDir, {
      packageManager: 'npm',
      ignoreScripts: true,
      destination: tempDir
    });

    const buffer = await fs.readFile(tarballPath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
  }

  it('should return empty result for non-TarballFileSystem', async () => {
    const localFileSystem = new LocalFileSystem(tempDir);
    const result = await runPublint(localFileSystem);

    expect(result).toEqual({
      messages: []
    });
  });

  it('should process package with publint errors', async () => {
    const tarball = await createTarballFromPackage(
      {
        name: 'test-package',
        version: '1.0.0',
        type: 'module',
        main: './non-existent-file.js'
      },
      {
        'index.js': 'export const test = "hello";'
      }
    );

    const fileSystem = new TarballFileSystem(tarball);
    const result = await runPublint(fileSystem);

    expect(result.messages.length).toBeGreaterThan(0);

    for (const message of result.messages) {
      expect(['error', 'warning', 'suggestion']).toContain(message.severity);
      expect(message.score).toBe(0);
      expect(typeof message.message).toBe('string');
      expect(message.message.length).toBeGreaterThan(0);
    }
  });

  it('should handle package with multiple publint issues', async () => {
    const tarball = await createTarballFromPackage(
      {
        name: 'test-package',
        version: '1.0.0',
        type: 'module',
        main: './missing-main.js',
        exports: {
          '.': './missing-export.js'
        },
        module: './missing-module.js'
      },
      {
        'index.js': 'export const test = "hello";'
      }
    );

    const fileSystem = new TarballFileSystem(tarball);
    const result = await runPublint(fileSystem);

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.severity === 'error')).toBe(true);
  });

  it('should handle package without issues', async () => {
    const tarball = await createTarballFromPackage(
      {
        name: 'test-package',
        version: '1.0.0',
        type: 'module',
        exports: {
          '.': './index.js'
        }
      },
      {
        'index.js': 'export const test = "hello";'
      }
    );

    const fileSystem = new TarballFileSystem(tarball);
    const result = await runPublint(fileSystem);

    expect(result).toHaveProperty('messages');
    expect(Array.isArray(result.messages)).toBe(true);
  });
});
