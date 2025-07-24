import {Message} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {LocalFileSystem} from '../local-file-system.js';
import {spawn} from 'node:child_process';

export async function runKnip(fileSystem: FileSystem) {
  const messages: Message[] = [];

  // Only support local file system for knip (it needs to run in the actual project directory)
  if (!(fileSystem instanceof LocalFileSystem)) {
    return messages;
  }

  try {
    // Get the root directory
    const rootDir = await fileSystem.getRootDir();
    
    // Check if knip is available by trying to spawn it
    const result = await new Promise<{stdout: string; stderr: string; code: number | null}>((resolve) => {
      const proc = spawn('npx', ['knip', '--reporter', 'json'], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => (stdout += data.toString()));
      proc.stderr.on('data', (data) => (stderr += data.toString()));
      
      proc.on('close', (code) => resolve({stdout, stderr, code}));
    });



    // If knip ran successfully, parse the results
    // Knip returns code 1 when it finds issues, which is normal
    if (result.code === 0 || result.code === 1) {
      try {
        const knipResult = JSON.parse(result.stdout);
        
        // Process knip results and convert to messages
        if (knipResult.files && knipResult.files.length > 0) {
          for (const file of knipResult.files) {
            messages.push({
              severity: 'warning',
              score: 0,
              message: `[knip] files: ${file} (unused)`
            });
          }
        }

        if (knipResult.issues && knipResult.issues.length > 0) {
          for (const issue of knipResult.issues) {
            // Handle dependencies
            if (issue.dependencies && issue.dependencies.length > 0) {
              for (const dep of issue.dependencies) {
                messages.push({
                  severity: 'warning',
                  score: 0,
                  message: `[knip] dependencies: ${dep.name} (unused)`
                });
              }
            }

            // Handle devDependencies
            if (issue.devDependencies && issue.devDependencies.length > 0) {
              for (const dep of issue.devDependencies) {
                messages.push({
                  severity: 'warning',
                  score: 0,
                  message: `[knip] devDependencies: ${dep.name} (unused)`
                });
              }
            }

            // Handle exports
            if (issue.exports && issue.exports.length > 0) {
              for (const exp of issue.exports) {
                messages.push({
                  severity: 'warning',
                  score: 0,
                  message: `[knip] exports: ${exp} (unused)`
                });
              }
            }
          }
        }

        // If no issues found, add a positive message
        if (messages.length === 0) {
          messages.push({
            severity: 'suggestion',
            score: 0,
            message: 'knip analysis passed - no unused dependencies, exports, or files found.'
          });
        }
             } catch {
         // If JSON parsing fails, knip might have output non-JSON content
         // This could happen if knip is not properly configured
         messages.push({
           severity: 'warning',
           score: 0,
           message: 'knip analysis completed but results could not be parsed.'
         });
       }
    } else {
      // knip ran but returned an error code
      // Check if it's a "no package.json" error, which is expected for empty directories
      if (result.stderr && result.stderr.includes('Unable to find package.json')) {
        // This is expected for directories without a package.json, so don't add any messages
        return messages;
      }
      
      // For other errors, add a warning message
      if (result.stderr) {
        messages.push({
          severity: 'warning',
          score: 0,
          message: `knip analysis failed: ${result.stderr.trim()}`
        });
      }
    }

  } catch {
    // knip is not available as a peer dependency
    // This is expected behavior, so we don't add any error messages
    // The plugin simply doesn't run when knip is not available
  }

  return messages;
} 