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
