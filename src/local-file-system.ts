import type {FileSystem} from './file-system.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {fileSystemLogger} from './logger.js';
import {fdir} from 'fdir';
import {readFile, stat} from 'node:fs/promises';
import {normalizePath} from './utils/path.js';

interface CrawlResult {
  packageFiles: string[];
  installSize: number;
}

export class LocalFileSystem implements FileSystem {
  #root: string;
  #logger = fileSystemLogger;
  #crawlResult: CrawlResult | undefined;

  constructor(root: string) {
    this.#root = root;
  }

  async getRootDir(): Promise<string> {
    return this.#root;
  }

  async #crawlNodeModules(): Promise<CrawlResult> {
    if (this.#crawlResult) return this.#crawlResult;

    const nodeModulesPath = path.join(this.#root, 'node_modules');
    const packageFiles: string[] = [];
    let installSize = 0;

    try {
      await fs.access(nodeModulesPath);
      const crawler = new fdir()
        .withFullPaths()
        .withSymlinks()
        .crawl(nodeModulesPath);
      const files = await crawler.withPromise();

      for (const filePath of files) {
        if (normalizePath(filePath).endsWith('/package.json')) {
          const relativePath = path.relative(this.#root, filePath);
          packageFiles.push('/' + normalizePath(relativePath));
        }
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

    this.#crawlResult = {packageFiles, installSize};
    return this.#crawlResult;
  }

  async listPackageFiles(): Promise<string[]> {
    const {packageFiles} = await this.#crawlNodeModules();
    return packageFiles;
  }

  async readFile(filePath: string): Promise<string> {
    return await readFile(path.join(this.#root, filePath), 'utf8');
  }

  async getInstallSize(): Promise<number> {
    const {installSize} = await this.#crawlNodeModules();
    return installSize;
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.#root, filePath));
      return true;
    } catch {
      return false;
    }
  }
}
