import {describe, it, expect} from 'vitest';
import {runReplacements} from '../analyze/replacements.js';
import {LocalFileSystem} from '../local-file-system.js';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Custom Manifests', () => {
  it('should load and use custom manifest files', async () => {
    const testDir = join(__dirname, '../../test/fixtures/fake-modules');
    const fileSystem = new LocalFileSystem(testDir);
    const customManifestPath = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );

    const result = await runReplacements(fileSystem, {
      manifest: [customManifestPath]
    });

    expect(result.messages).toMatchSnapshot();
  });

  it('should handle invalid manifest files gracefully', async () => {
    const testDir = join(__dirname, '../../test/fixtures/fake-modules');
    const fileSystem = new LocalFileSystem(testDir);
    const invalidManifestPath = 'non-existent-file.json';

    const result = await runReplacements(fileSystem, {
      manifest: [invalidManifestPath]
    });

    expect(result.messages).toMatchSnapshot();
  });

  it('should prioritize custom replacements over built-in ones', async () => {
    const testDir = join(__dirname, '../../test/fixtures/fake-modules');
    const fileSystem = new LocalFileSystem(testDir);
    const customManifestPath = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );

    const resultWithCustom = await runReplacements(fileSystem, {
      manifest: [customManifestPath]
    });
    const resultWithoutCustom = await runReplacements(fileSystem);

    expect({
      withCustom: resultWithCustom.messages,
      withoutCustom: resultWithoutCustom.messages
    }).toMatchSnapshot();
  });

  it('should load multiple manifest files', async () => {
    const testDir = join(__dirname, '../../test/fixtures/fake-modules');
    const fileSystem = new LocalFileSystem(testDir);
    const manifest1Path = join(
      __dirname,
      '../../test/fixtures/custom-manifest.json'
    );
    const manifest2Path = join(
      __dirname,
      '../../test/fixtures/custom-manifest-2.json'
    );

    const result = await runReplacements(fileSystem, {
      manifest: [manifest1Path, manifest2Path]
    });

    expect(result.messages).toMatchSnapshot();
  });
});
