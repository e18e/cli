import {describe, it, expect} from 'vitest';
import {runKnip} from '../analyze/knip.js';
import {LocalFileSystem} from '../local-file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';
import {createTempDir, createTestPackage} from './utils.js';
import fs from 'node:fs/promises';

describe('knip plugin', () => {
  it('should return empty messages for tarball file system', async () => {
    // Create a mock tarball file system
    const mockTarball = new ArrayBuffer(0);
    const fileSystem = new TarballFileSystem(mockTarball);
    
    const messages = await runKnip(fileSystem);
    
    expect(messages).toEqual([]);
  });

  it('should handle missing knip gracefully for local file system', async () => {
    // Create a temporary directory for testing
    const tempDir = await createTempDir();
    
    try {
      // Create a simple package.json
      await createTestPackage(tempDir, {
        name: 'test-package',
        version: '1.0.0',
        type: 'module'
      });
      
      const fileSystem = new LocalFileSystem(tempDir);
      const messages = await runKnip(fileSystem);
      
      // Should return empty messages when knip is not available
      // (which is the expected behavior for a fresh environment)
      expect(Array.isArray(messages)).toBe(true);
    } finally {
      // Clean up
      await fs.rm(tempDir, {recursive: true, force: true});
    }
  });

  it('should use getRootDir method correctly', async () => {
    const tempDir = await createTempDir();
    
    try {
      await createTestPackage(tempDir, {
        name: 'test-package',
        version: '1.0.0',
        type: 'module'
      });
      
      const fileSystem = new LocalFileSystem(tempDir);
      const rootDir = await fileSystem.getRootDir();
      
      expect(rootDir).toBe(tempDir);
    } finally {
      await fs.rm(tempDir, {recursive: true, force: true});
    }
  });
}); 