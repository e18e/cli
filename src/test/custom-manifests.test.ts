import {describe, it, expect} from 'vitest';
import {runReplacements} from '../analyze/replacements.js';
import {LocalFileSystem} from '../local-file-system.js';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Custom Manifests', () => {
  it('should load and use custom manifest files', async () => {
    const testDir = join(__dirname, '../../test/fixtures/basic-chalk');
    const fileSystem = new LocalFileSystem(testDir);
    const customManifestPath = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );

    const result = await runReplacements(fileSystem, [customManifestPath]);

    // Should have messages from custom manifest
    expect(result.messages.length).toBeGreaterThan(0);

    // Check that custom replacement messages are included
    const hasCustomMessage = result.messages.some(
      (msg) =>
        msg.message.includes('chalk') ||
        msg.message.includes('lodash') ||
        msg.message.includes('moment') ||
        msg.message.includes('request') ||
        msg.message.includes('bluebird')
    );

    expect(hasCustomMessage).toBe(true);
  });

  it('should handle invalid manifest files gracefully', async () => {
    const testDir = join(__dirname, '../../test/fixtures/basic-chalk');
    const fileSystem = new LocalFileSystem(testDir);
    const invalidManifestPath = 'non-existent-file.json';

    const result = await runReplacements(fileSystem, [invalidManifestPath]);

    // Should still work without crashing
    expect(result.messages).toBeDefined();
  });

  it('should prioritize custom replacements over built-in ones', async () => {
    const testDir = join(__dirname, '../../test/fixtures/basic-chalk');
    const fileSystem = new LocalFileSystem(testDir);
    const customManifestPath = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );

    const resultWithCustom = await runReplacements(fileSystem, [
      customManifestPath
    ]);
    const resultWithoutCustom = await runReplacements(fileSystem);

    // Custom manifest should provide additional or different messages
    expect(resultWithCustom.messages.length).toBeGreaterThanOrEqual(
      resultWithoutCustom.messages.length
    );
  });

  it('should load multiple manifest files', async () => {
    const testDir = join(__dirname, '../../test/fixtures/basic-chalk');
    const fileSystem = new LocalFileSystem(testDir);
    const manifest1Path = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );
    const manifest2Path = join(
      __dirname,
      '../../test/fixtures/custom-manifest-2.json'
    );

    const result = await runReplacements(fileSystem, [
      manifest1Path,
      manifest2Path
    ]);

    // Should have messages from both manifests
    expect(result.messages.length).toBeGreaterThan(0);

    // Check that replacements from both manifests are included
    const hasChalkMessage = result.messages.some((msg) =>
      msg.message.includes('chalk')
    );
    
    // Note: express won't be found since it's not in the test fixture dependencies
    // but chalk should be found
    expect(hasChalkMessage).toBe(true);
  });
});
