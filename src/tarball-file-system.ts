import {unpack, type UnpackResult} from '@publint/pack';
import type {FileSystem} from './file-system.js';
import path from 'node:path';

export class TarballFileSystem implements FileSystem {
  #tarball: ArrayBuffer;
  #unpackResult?: UnpackResult;

  public get tarball(): ArrayBuffer {
    return this.#tarball;
  }

  constructor(tarball: ArrayBuffer) {
    this.#tarball = tarball;
  }

  async #getUnpackResult(): Promise<UnpackResult> {
    if (!this.#unpackResult) {
      this.#unpackResult = await unpack(this.#tarball);
    }
    return this.#unpackResult;
  }

  async getRootDir(): Promise<string> {
    const {rootDir} = await this.#getUnpackResult();
    return rootDir;
  }

  async listPackageFiles(): Promise<string[]> {
    const {files} = await this.#getUnpackResult();

    return files
      .filter((file) => file.name.endsWith('/package.json'))
      .map((file) => file.name);
  }

  async readFile(filePath: string): Promise<string> {
    const {files} = await this.#getUnpackResult();
    const fullPath = path.posix.join(await this.getRootDir(), filePath);
    const file = files.find((f) => f.name === fullPath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }
    return new TextDecoder().decode(file.data);
  }

  async getInstallSize(): Promise<number> {
    const {files} = await this.#getUnpackResult();
    return files.reduce((acc, file) => acc + file.data.byteLength, 0);
  }

  async fileExists(filePath: string): Promise<boolean> {
    const {files} = await this.#getUnpackResult();
    const rootDir = await this.getRootDir();
    const fullPath = path.posix.join(rootDir, filePath);
    return files.some((file) => file.name === fullPath);
  }
}
