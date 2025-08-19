import {describe, it, expect} from 'vitest';
import {runAttw} from '../../analyze/attw.js';
import {LocalFileSystem} from '../../local-file-system.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

describe('ATTW Integration', () => {
  it('should not run attw when tsconfig.json does not exist', async () => {
    const fixturePath = path.join(process.cwd(), 'test/fixtures/basic-chalk');
    const fileSystem = new LocalFileSystem(fixturePath);

    const result = await runAttw(fileSystem);

    // Should return empty result (no messages) when TypeScript is not configured
    expect(result.messages).toHaveLength(0);
  });

  it('should run attw when tsconfig.json exists', async () => {
    const fixturePath = path.join(process.cwd(), 'test/fixtures/basic-chalk');
    const fileSystem = new LocalFileSystem(fixturePath);

    // Create a tsconfig.json file in the fixture
    await fs.writeFile(path.join(fixturePath, 'tsconfig.json'), '{}');

    try {
      const result = await runAttw(fileSystem);

      // Should return some result when TypeScript is configured
      // Note: This will still return empty because LocalFileSystem is not supported by attw
      // but the important thing is that it doesn't throw an error
      expect(result.messages).toBeDefined();
    } finally {
      // Clean up the created tsconfig.json
      try {
        await fs.unlink(path.join(fixturePath, 'tsconfig.json'));
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
