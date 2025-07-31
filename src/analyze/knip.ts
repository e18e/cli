import {ReportPluginResult} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {LocalFileSystem} from '../local-file-system.js';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

async function which(cmd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('which', [cmd]);
    let output = '';
    proc.stdout.on('data', (data) => (output += data.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });
    proc.on('error', () => {
      resolve(null);
    });
  });
}

export async function runKnip(fileSystem: FileSystem): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  // Only support local file system for knip (it needs to run in the actual project directory)
  if (!(fileSystem instanceof LocalFileSystem)) {
    return result;
  }

  try {
    const rootDir = await fileSystem.getRootDir();

    const localKnip = join(rootDir, 'node_modules', '.bin', 'knip');
    let knipAvailable = false;
    if (existsSync(localKnip)) {
      knipAvailable = true;
    } else {
      const globalKnip = await which('knip');
      if (globalKnip) {
        knipAvailable = true;
      }
    }
    if (!knipAvailable) {
      return result;
    }

    const npxPath = await which('npx');
    if (!npxPath) {
      return result;
    }

    const spawnResult = await new Promise<{stdout: string; stderr: string; code: number | null}>((resolve) => {
      const proc = spawn(npxPath, ['knip', '--reporter', 'json'], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => (stdout += data.toString()));
      proc.stderr.on('data', (data) => (stderr += data.toString()));
      proc.on('close', (code) => resolve({stdout, stderr, code}));
      proc.on('error', () => resolve({stdout: '', stderr: 'Process error', code: 1}));
    });

    // If knip ran successfully, parse the results
    // Knip returns code 1 when it finds issues, which is normal
    if (spawnResult.code === 0 || spawnResult.code === 1) {
      try {
        const knipResult = JSON.parse(spawnResult.stdout);
        if (knipResult.files && knipResult.files.length > 0) {
          for (const file of knipResult.files) {
            result.messages.push({
              severity: 'warning',
              score: 0,
              message: `[knip] files: ${file} (unused)`
            });
          }
        }
        if (knipResult.issues && knipResult.issues.length > 0) {
          for (const issue of knipResult.issues) {
            if (issue.dependencies && issue.dependencies.length > 0) {
              for (const dep of issue.dependencies) {
                result.messages.push({
                  severity: 'warning',
                  score: 0,
                  message: `[knip] dependencies: ${dep.name} (unused)`
                });
              }
            }
            if (issue.devDependencies && issue.devDependencies.length > 0) {
              for (const dep of issue.devDependencies) {
                result.messages.push({
                  severity: 'warning',
                  score: 0,
                  message: `[knip] devDependencies: ${dep.name} (unused)`
                });
              }
            }
            if (issue.exports && issue.exports.length > 0) {
              for (const exp of issue.exports) {
                result.messages.push({
                  severity: 'warning',
                  score: 0,
                  message: `[knip] exports: ${exp} (unused)`
                });
              }
            }
          }
        }
        if (result.messages.length === 0) {
          result.messages.push({
            severity: 'suggestion',
            score: 0,
            message: 'knip analysis passed - no unused dependencies, exports, or files found.'
          });
        }
      } catch {
        result.messages.push({
          severity: 'warning',
          score: 0,
          message: 'knip analysis completed but results could not be parsed.'
        });
      }
    } else {
      if (spawnResult.stderr && spawnResult.stderr.includes('Unable to find package.json')) {
        return result;
      }
      if (spawnResult.stderr) {
        result.messages.push({
          severity: 'warning',
          score: 0,
          message: `knip analysis failed: ${spawnResult.stderr.trim()}`
        });
      }
    }
  } catch {
    // knip is not available as a peer dependency or another error occurred
    // This is expected behavior, so we don't add any error messages
    // The plugin simply doesn't run when knip is not available
  }
  return result;
} 