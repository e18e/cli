import * as replacements from 'module-replacements';
import type {ManifestModule, ModuleReplacement} from 'module-replacements';
import {ReportPluginResult} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {getPackageJson} from '../utils/package-json.js';
import {resolve, dirname, basename} from 'node:path';
import {
  satisfies as semverSatisfies,
  ltr as semverLessThan,
  minVersion,
  validRange
} from 'semver';
import {LocalFileSystem} from '../local-file-system.js';
import type {Options} from '../types.js';

/**
 * Generates a standard URL to the docs of a given rule
 * @param {string} name Rule name
 * @return {string}
 */
export function getDocsUrl(name: string): string {
  return `https://github.com/es-tooling/eslint-plugin-depend/blob/main/docs/rules/${name}.md`;
}

/**
 * Generates a URL for the given path on MDN
 * @param {string} path Docs path
 * @return {string}
 */
export function getMdnUrl(path: string): string {
  return `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/${path}`;
}

async function loadCustomManifests(
  manifestPaths?: string[]
): Promise<ModuleReplacement[]> {
  if (!manifestPaths || manifestPaths.length === 0) {
    return [];
  }

  const customReplacements: ModuleReplacement[] = [];

  for (const manifestPath of manifestPaths) {
    try {
      const absolutePath = resolve(manifestPath);
      const manifestDir = dirname(absolutePath);
      const manifestFileName = basename(absolutePath);
      const localFileSystem = new LocalFileSystem(manifestDir);
      const manifestContent = await localFileSystem.readFile(
        `/${manifestFileName}`
      );
      const manifest: ManifestModule = JSON.parse(manifestContent);

      if (
        manifest.moduleReplacements &&
        Array.isArray(manifest.moduleReplacements)
      ) {
        customReplacements.push(...manifest.moduleReplacements);
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to load custom manifest from ${manifestPath}: ${error}`
      );
    }
  }

  return customReplacements;
}

function isNodeEngineCompatible(
  requiredNode: string,
  enginesNode: string
): boolean {
  const requiredRange = validRange(requiredNode);
  const engineRange = validRange(enginesNode);

  if (!requiredRange || !engineRange) {
    return true;
  }

  const requiredMin = minVersion(requiredRange);
  if (!requiredMin) {
    return true;
  }

  return (
    semverLessThan(requiredMin.version, engineRange) ||
    semverSatisfies(requiredMin.version, engineRange)
  );
}

export async function runReplacements(
  fileSystem: FileSystem,
  options?: Options
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  const packageJson = await getPackageJson(fileSystem);

  if (!packageJson || !packageJson.dependencies) {
    // No dependencies
    return result;
  }

  // Load custom manifests
  const customReplacements = await loadCustomManifests(options?.manifest);

  // Combine custom and built-in replacements
  const allReplacements = [
    ...customReplacements,
    ...replacements.all.moduleReplacements
  ];

  for (const name of Object.keys(packageJson.dependencies)) {
    // Find replacement (custom replacements take precedence due to order)
    const replacement = allReplacements.find(
      (replacement) => replacement.moduleName === name
    );

    if (!replacement) {
      continue;
    }

    // Handle each replacement type using the same logic for both custom and built-in
    if (replacement.type === 'none') {
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be removed, and native functionality used instead`
      });
    } else if (replacement.type === 'simple') {
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be replaced. ${replacement.replacement}.`
      });
    } else if (replacement.type === 'native') {
      const enginesNode = packageJson.engines?.node;
      let supported = true;

      if (replacement.nodeVersion && enginesNode) {
        supported = isNodeEngineCompatible(
          replacement.nodeVersion,
          enginesNode
        );
      }

      if (!supported) {
        continue;
      }

      const mdnPath = getMdnUrl(replacement.mdnPath);
      const requires =
        replacement.nodeVersion && !enginesNode
          ? ` Required Node >= ${replacement.nodeVersion}.`
          : '';
      const message = `Module "${name}" can be replaced with native functionality. Use "${replacement.replacement}" instead.${requires}`;
      const fullMessage = `${message} You can read more at ${mdnPath}.`;
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: fullMessage
      });
    } else if (replacement.type === 'documented') {
      const docUrl = getDocsUrl(replacement.docPath);
      const message = `Module "${name}" can be replaced with a more performant alternative.`;
      const fullMessage = `${message} See the list of available alternatives at ${docUrl}.`;
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: fullMessage
      });
    }
  }

  return result;
}
