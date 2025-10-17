import {describe, it, expect, beforeEach, vi} from 'vitest';
import * as path from 'node:path';

import {TarballFileSystem} from '../tarball-file-system.js';

const enc = (s: string) => new TextEncoder().encode(s);
let mockFiles: Array<{name: string; data: Uint8Array}>;
const mockRootDir = 'package';

vi.mock('@publint/pack', () => {
  return {
    unpack: vi.fn(async () => ({
      rootDir: mockRootDir,
      files: mockFiles
    }))
  };
});

describe('TarballFileSystem', () => {
  beforeEach(() => {
    mockFiles = [
      {
        name: path.posix.join(mockRootDir, 'package.json'),
        data: enc(JSON.stringify({name: 'pkg', version: '1.0.0'}))
      },
      {
        name: path.posix.join(mockRootDir, 'tsconfig.json'),
        data: enc('{}')
      },
      {
        name: path.posix.join(mockRootDir, 'node_modules/a/package.json'),
        data: enc(JSON.stringify({name: 'a', version: '1.0.0'}))
      },
      {
        name: path.posix.join(
          mockRootDir,
          'node_modules/a/node_modules/b/package.json'
        ),
        data: enc(JSON.stringify({name: 'b', version: '1.0.0'}))
      },
      {
        name: path.posix.join(mockRootDir, 'node_modules/a/readme.txt'),
        data: enc('abc')
      }
    ];
  });

  it('should report true for an existing file and false for a missing file', async () => {
    const tfs = new TarballFileSystem(new ArrayBuffer(0));

    expect(await tfs.fileExists('/tsconfig.json')).toBe(true);
    expect(await tfs.fileExists('/does-not-exist.json')).toBe(false);
  });

  it('should read /package.json and throw on a non-existent path', async () => {
    const tfs = new TarballFileSystem(new ArrayBuffer(0));

    const text = await tfs.readFile('/package.json');
    expect(JSON.parse(text).name).toBe('pkg');

    await expect(tfs.readFile('/nope.json')).rejects.toBeTruthy();
  });

  it('should list package.json files, including nested ones', async () => {
    const tfs = new TarballFileSystem(new ArrayBuffer(0));
    const root = await tfs.getRootDir();
    const files = await tfs.listPackageFiles();

    expect(files).toContain(path.posix.join(root, 'package.json'));
    expect(files).toContain(
      path.posix.join(root, 'node_modules/a/package.json')
    );
    expect(files).toContain(
      path.posix.join(root, 'node_modules/a/node_modules/b/package.json')
    );
  });

  it('should compute install size as the sum of file bytes from the unpacked tarball', async () => {
    const tfs = new TarballFileSystem(new ArrayBuffer(0));
    const expected = mockFiles.reduce((n, f) => n + f.data.byteLength, 0);
    const size = await tfs.getInstallSize();
    expect(size).toBe(expected);
  });
});
