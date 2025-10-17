import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {LocalFileSystem} from '../local-file-system.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';

describe('LocalFileSystem', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'lfs-'));
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({name: 'pkg', version: '1.0.0'})
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, {recursive: true, force: true});
  });

  it('should report false for a missing file and true for an existing file', async () => {
    const lfs = new LocalFileSystem(tempDir);
    expect(await lfs.fileExists('/tsconfig.json')).toBe(false);

    await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
    expect(await lfs.fileExists('/tsconfig.json')).toBe(true);
  });

  it('should read /package.json and throw on a non-existent path', async () => {
    const lfs = new LocalFileSystem(tempDir);

    const text = await lfs.readFile('/package.json');
    expect(JSON.parse(text).name).toBe('pkg');

    await expect(lfs.readFile('/does-not-exist.json')).rejects.toBeTruthy();
  });

  it('should return an empty list of package files when node_modules is missing', async () => {
    const lfs = new LocalFileSystem(tempDir);
    const files = await lfs.listPackageFiles();
    expect(files).toEqual([]);
  });

  it('should list package.json files in node_modules, including nested ones', async () => {
    await fs.mkdir(
      path.join(tempDir, 'node_modules', 'a', 'node_modules', 'b'),
      {
        recursive: true
      }
    );
    await fs.writeFile(
      path.join(tempDir, 'node_modules', 'a', 'package.json'),
      JSON.stringify({name: 'a', version: '1.0.0'})
    );
    await fs.writeFile(
      path.join(
        tempDir,
        'node_modules',
        'a',
        'node_modules',
        'b',
        'package.json'
      ),
      JSON.stringify({name: 'b', version: '1.0.0'})
    );

    const lfs = new LocalFileSystem(tempDir);
    const files = await lfs.listPackageFiles();

    expect(files.some((p) => p.endsWith('/node_modules/a/package.json'))).toBe(
      true
    );
    expect(
      files.some((p) =>
        p.endsWith('/node_modules/a/node_modules/b/package.json')
      )
    ).toBe(true);
  });

  it('should report 0 install size without node_modules and a positive size when files exist', async () => {
    const lfs = new LocalFileSystem(tempDir);
    expect(await lfs.getInstallSize()).toBe(0);

    await fs.mkdir(path.join(tempDir, 'node_modules', 'x'), {recursive: true});
    await fs.writeFile(
      path.join(tempDir, 'node_modules', 'x', 'f1.txt'),
      'abc'
    );
    await fs.writeFile(path.join(tempDir, 'node_modules', 'x', 'f2.txt'), 'X');

    const size = await lfs.getInstallSize();
    expect(size).toBeGreaterThan(0);
  });
});
