import type {FileSystem} from './file-system.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {fileSystemLogger} from './logger.js';
import {fdir} from 'fdir';
import {readFile, stat} from 'node:fs/promises';
import {normalizePath} from './utils/path.js';

export class LocalFileSystem implements FileSystem {
  #root: string;
  #logger = fileSystemLogger;

  constructor(root: string) {
    this.#root = root;
  }

  async getRootDir(): Promise<string> {
    return this.#root;
  }

  async listPackageFiles(): Promise<string[]> {
    const nodeModulesPath = path.join(this.#root, 'node_modules');

    try {
      await fs.access(nodeModulesPath);
      const crawler = new fdir()
        .withFullPaths()
        .withSymlinks()
        .filter((filePath) => normalizePath(filePath).endsWith('/package.json'))
        .crawl(nodeModulesPath);
      const files = await crawler.withPromise();
      return files.map((file) => {
        const relativePath = path.relative(this.#root, file);
        return '/' + normalizePath(relativePath);
      });
    } catch {
      return [];
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await readFile(path.join(this.#root, filePath), 'utf8');
  }

  async getInstallSize(): Promise<number> {
    const nodeModulesPath = path.join(this.#root, 'node_modules');

    let installSize = 0;

    try {
      await fs.access(nodeModulesPath);

      // TODO (43081j): we traverse the file system twice. Once here,
      // and once when finding the package.json files. It may be worth
      // caching some things one day so we only traverse once.
      const crawler = new fdir()
        .withFullPaths()
        .withSymlinks()
        .crawl(nodeModulesPath);
      const files = await crawler.withPromise();
      for (const filePath of files) {
        try {
          const stats = await stat(filePath);
          installSize += stats.size;
        } catch {
          this.#logger.debug('Error getting file stats for:', filePath);
        }
      }
    } catch {
      this.#logger.debug('No node_modules directory found');
    }

    return installSize;
  }
}
