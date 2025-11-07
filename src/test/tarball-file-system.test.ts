import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TarballFileSystem} from '../tarball-file-system.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

async function runNpmPack(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['pack'], {cwd});

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm pack failed with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function createTarballBuffer(cwd: string): Promise<ArrayBuffer> {
  await runNpmPack(cwd);

  // Find the generated .tgz file
  const files = await fs.readdir(cwd);
  const tgzFile = files.find((f) => f.endsWith('.tgz'));
  if (!tgzFile) {
    throw new Error('No .tgz file found after npm pack');
  }

  // Read the tarball as ArrayBuffer
  const tgzPath = path.join(cwd, tgzFile);
  const buffer = await fs.readFile(tgzPath);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

describe('TarballFileSystem', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'reporter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, {recursive: true, force: true});
  });

  describe('fileExists', () => {
    it('should return false when file does not exist in tarball', async () => {
      // Create a minimal package.json for the tarball
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0'
        })
      );

      const tarball = await createTarballBuffer(tempDir);
      const fileSystem = new TarballFileSystem(tarball);
      const hasConfig = await fileSystem.fileExists('/tsconfig.json');
      expect(hasConfig).toBe(false);
    });

    it('should return true when file exists in tarball', async () => {
      // Create a minimal package.json for the tarball
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0'
        })
      );

      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
      const tarball = await createTarballBuffer(tempDir);
      const fileSystem = new TarballFileSystem(tarball);
      const hasConfig = await fileSystem.fileExists('/tsconfig.json');
      expect(hasConfig).toBe(true);
    });
  });
});
