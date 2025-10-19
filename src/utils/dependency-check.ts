import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {detect, resolveCommand} from 'package-manager-detector';
import * as p from '@clack/prompts';
import c from 'picocolors';

const require = createRequire(import.meta.url);

/**
 * Checks if a package is installed and can be imported
 */
export function isPackageInstalled(packageName: string): boolean {
  try {
    // Check only in current directory's node_modules, not parent directories
    const {resolve} = require('node:path');
    const localPath = resolve('./node_modules', packageName);
    require.resolve(localPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts the user to install a missing package
 * Returns true if user wants to proceed with installation
 */
export async function promptToInstall(packageName: string): Promise<boolean> {
  p.log.warn(
    `${c.yellow('Optional dependency not found:')} ${c.bold(packageName)}`
  );
  p.log.message(`This package is required for the feature you've enabled.`, {
    spacing: 0
  });

  const shouldInstall = await p.confirm({
    message: `Would you like to install ${c.cyan(packageName)} now?`
  });

  if (p.isCancel(shouldInstall)) {
    return false;
  }

  return shouldInstall;
}

/**
 * Automatically installs a package using the detected package manager
 */
export async function installPackage(packageName: string): Promise<boolean> {
  const detected = await detect();
  const agent = detected?.agent || 'npm';

  const resolved = resolveCommand(agent, 'add', [packageName]);

  if (!resolved) {
    p.log.error(`Failed to resolve install command for ${c.cyan(agent)}`);
    return false;
  }

  p.log.info(`Installing ${c.cyan(packageName)} with ${c.cyan(agent)}...`);

  return new Promise((resolve) => {
    const child = spawn(resolved.command, resolved.args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        p.log.success(`Successfully installed ${c.cyan(packageName)}!`);
        resolve(true);
      } else {
        p.log.error(`Failed to install ${c.cyan(packageName)}`);
        resolve(false);
      }
    });
  });
}
