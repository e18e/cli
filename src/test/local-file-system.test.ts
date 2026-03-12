import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {LocalFileSystem} from '../local-file-system.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';

describe('LocalFileSystem', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'reporter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, {recursive: true, force: true});
  });

  describe('getFileSize', () => {
    it('returns the byte size of an existing file', async () => {
      const content = 'hello world';
      await fs.writeFile(path.join(tempDir, 'file.txt'), content);
      const fileSystem = new LocalFileSystem(tempDir);
      const size = await fileSystem.getFileSize('file.txt');
      expect(size).toBe(Buffer.byteLength(content, 'utf8'));
    });

    it('throws for a non-existent file', async () => {
      const fileSystem = new LocalFileSystem(tempDir);
      await expect(fileSystem.getFileSize('missing.txt')).rejects.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return false when tsconfig.json does not exist', async () => {
      const fileSystem = new LocalFileSystem(tempDir);
      const hasConfig = await fileSystem.fileExists('/tsconfig.json');
      expect(hasConfig).toBe(false);
    });

    it('should return true when file exists', async () => {
      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
      const fileSystem = new LocalFileSystem(tempDir);
      const hasConfig = await fileSystem.fileExists('/tsconfig.json');
      expect(hasConfig).toBe(true);
    });
  });
});
