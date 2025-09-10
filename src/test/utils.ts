import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

export interface TestPackage {
  name: string;
  version: string;
  type?: 'module' | 'commonjs';
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  main?: string;
  exports?: Record<string, any>;
}

export interface TestPackageSetup {
  root: string;
  packages: TestPackage[];
}

export async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'reporter-test-'));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await fs.rm(dir, {recursive: true, force: true});
}

export async function createTestPackage(
  root: string,
  pkg: TestPackage,
  options: {createNodeModules?: boolean} = {}
): Promise<void> {
  // Create package.json
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );

  // Create node_modules if requested
  if (options.createNodeModules) {
    await fs.mkdir(path.join(root, 'node_modules'));
  }
}

export async function createTestPackageWithDependencies(
  root: string,
  pkg: TestPackage,
  dependencies: TestPackage[]
): Promise<void> {
  // Create root package
  await createTestPackage(root, pkg, {createNodeModules: true});

  // Create dependencies
  const nodeModules = path.join(root, 'node_modules');
  for (const dep of dependencies) {
    const depDir = path.join(nodeModules, dep.name);
    await fs.mkdir(depDir);
    await createTestPackage(depDir, dep);
  }
}

export function createMockTarball(files: Array<{name: string; content: any}>) {
  return {
    files: files.map((file) => ({
      name: file.name,
      data: new TextEncoder().encode(
        typeof file.content === 'string'
          ? file.content
          : JSON.stringify(file.content)
      )
    })),
    rootDir: 'package'
  };
}

export function runCliProcess(
  args: string[],
  cwd?: string,
  input?: string
): Promise<{stdout: string; stderr: string; code: number | null}> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(__dirname, '../../lib/cli.js');
    const proc = spawn('node', [cliPath, ...args], {
      env: process.env,
      cwd: cwd || process.cwd(),
      stdio: input ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    if (proc.stdout) {
      proc.stdout.on('data', (data) => (stdout += data.toString()));
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data) => (stderr += data.toString()));
    }
    proc.on('error', (err) => {
      stderr += String(err);
      resolve({stdout, stderr, code: 1});
    });
    proc.on('close', (code) => resolve({stdout, stderr, code}));

    // If input is provided, write it to stdin
    if (input && proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

const cachedRealPaths = new Map<string, string>();

export const stripVersion = async (
  str: string,
  cwd: string = process.cwd()
): Promise<string> => {
  const cwdRealPath = cachedRealPaths.get(cwd) ?? (await fs.realpath(cwd));
  cachedRealPaths.set(cwd, cwdRealPath);

  return str
    .replace(
      new RegExp(/\(cli v\d+\.\d+\.\d+(?:-\S+)?\)/, 'g'),
      '(cli <version>)'
    )
    .replaceAll(cwdRealPath, '{cwd}')
    .replaceAll(cwd, '{cwd}');
};
