export interface FileSystem {
  getRootDir(): Promise<string>;
  listPackageFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
  getInstallSize(): Promise<number>;
  hasTypeScriptConfig(): Promise<boolean>;
  fileExists(path: string): Promise<boolean>;
}
