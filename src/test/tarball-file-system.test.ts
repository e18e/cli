import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {TarballFileSystem} from '../tarball-file-system.js';
import {detectAndPack} from '../detect-and-pack-node.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';

describe('TarballFileSystem', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'reporter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, {recursive: true, force: true});
  });

  describe('File Existence with tsconfig.json in tarball', () => {
    it('should return false when tsconfig.json does not exist in tarball', async () => {
      // Create a minimal package.json for the tarball
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0'
        })
      );

      const tarball = await detectAndPack(tempDir, 'npm');
      const fileSystem = new TarballFileSystem(tarball);
      const hasConfig = await fileSystem.fileExists('/tsconfig.json');
      expect(hasConfig).toBe(false);
    });

    it('should return true when tsconfig.json exists in tarball', async () => {
      // Create a minimal package.json for the tarball
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0'
        })
      );

      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
      const tarball = await detectAndPack(tempDir, 'npm');
      const fileSystem = new TarballFileSystem(tarball);
      const hasConfig = await fileSystem.fileExists('/tsconfig.json');
      expect(hasConfig).toBe(true);
    });
  });

  describe('File Existence', () => {
    it('should return false when file does not exist in tarball', async () => {
      // Create a minimal package.json for the tarball
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0'
        })
      );

      const tarball = await detectAndPack(tempDir, 'npm');
      const fileSystem = new TarballFileSystem(tarball);
      const exists = await fileSystem.fileExists('/nonexistent.txt');
      expect(exists).toBe(false);
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

      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      const tarball = await detectAndPack(tempDir, 'npm');
      const fileSystem = new TarballFileSystem(tarball);
      const exists = await fileSystem.fileExists('/test.txt');
      expect(exists).toBe(true);
    });
  });
});
