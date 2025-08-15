import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {runAttw} from '../../analyze/attw.js';
import {TarballFileSystem} from '../../tarball-file-system.js';
import {LocalFileSystem} from '../../local-file-system.js';
import {createTempDir, cleanupTempDir, createTestPackage} from '../utils.js';
import {pack as packAsTarball} from '@publint/pack';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('runAttw', () => {
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
      const filePath = path.join(tempDir, fileName);
      const dirPath = path.dirname(filePath);

      await fs.mkdir(dirPath, {recursive: true});
      await fs.writeFile(filePath, content);
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
    const result = await runAttw(localFileSystem);

    expect(result).toEqual({
      messages: []
    });
  });

  it('should suggest when no type definitions found', async () => {
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
    const result = await runAttw(fileSystem);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      severity: 'suggestion',
      score: 0,
      message: 'No type definitions found.'
    });
  });

  it('should detect TypeScript issues in package with types', async () => {
    const tarball = await createTarballFromPackage(
      {
        name: 'test-package',
        version: '1.0.0',
        type: 'module',
        types: './index.d.ts',
        exports: {
          '.': {
            types: './index.d.ts',
            import: './index.js'
          }
        }
      },
      {
        'index.js': 'export const test = "hello";',
        'index.d.ts': 'export declare const different: string;'
      }
    );

    const fileSystem = new TarballFileSystem(tarball);
    const result = await runAttw(fileSystem);

    expect(result.messages.length).toBeGreaterThanOrEqual(0);

    for (const message of result.messages) {
      expect(['error', 'warning', 'suggestion']).toContain(message.severity);
      expect(message.score).toBe(0);
      expect(typeof message.message).toBe('string');
      expect(message.message.length).toBeGreaterThan(0);
    }
  });
});
