import type {FileSystem} from '../file-system.js';
import type {PackageJsonLike} from '../types.js';

export async function getPackageJson(
  fileSystem: FileSystem
): Promise<PackageJsonLike | null> {
  let packageJsonText: string;

  try {
    packageJsonText = await fileSystem.readFile('/package.json');
  } catch {
    // No package.json found
    return null;
  }

  try {
    return JSON.parse(packageJsonText);
  } catch {
    // Not parseable
    return null;
  }
}
