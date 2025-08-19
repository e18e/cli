import * as replacements from 'module-replacements';
import {
  ReportPluginResult,
  CustomManifest,
  CustomReplacement
} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {getPackageJson} from '../file-system-utils.js';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import semverSatisfies from 'semver/functions/satisfies.js';
import semverLessThan from 'semver/ranges/ltr.js';
import {minVersion, validRange} from 'semver';

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
): Promise<CustomReplacement[]> {
  if (!manifestPaths || manifestPaths.length === 0) {
    return [];
  }

  const customReplacements: CustomReplacement[] = [];

  for (const manifestPath of manifestPaths) {
    try {
      const absolutePath = resolve(manifestPath);
      const manifestContent = await readFile(absolutePath, 'utf8');
      const manifest: CustomManifest = JSON.parse(manifestContent);

      if (manifest.replacements && Array.isArray(manifest.replacements)) {
        customReplacements.push(...manifest.replacements);
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
  customManifests?: string[]
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
  const customReplacements = await loadCustomManifests(customManifests);

  for (const name of Object.keys(packageJson.dependencies)) {
    // Check custom replacements first
    let replacement = customReplacements.find(
      (replacement) => replacement.moduleName === name
    );

    // If no custom replacement found, check built-in replacements
    if (!replacement) {
      replacement = replacements.all.moduleReplacements.find(
        (replacement) => replacement.moduleName === name
      );
    }

    if (!replacement) {
      continue;
    }

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
        message: `Module "${name}" can be replaced. ${replacement.replacement || 'See documentation for details'}.`
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

      const mdnPath = replacement.mdnPath
        ? getMdnUrl(replacement.mdnPath)
        : undefined;
      const requires =
        replacement.nodeVersion && !enginesNode
          ? ` Required Node >= ${replacement.nodeVersion}.`
          : '';
      const message = `Module "${name}" can be replaced with native functionality. Use "${replacement.replacement || 'native alternative'}" instead.`;
      const fullMessage = mdnPath
        ? `${message} You can read more at ${mdnPath}.`
        : message;
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be replaced with native functionality. Use "${replacement.replacement}" instead. You can read more at ${mdnPath}.${requires}`
      });
    } else if (replacement.type === 'documented') {
      const docUrl = replacement.docPath
        ? getDocsUrl(replacement.docPath)
        : undefined;
      const message = `Module "${name}" can be replaced with a more performant alternative.`;
      const fullMessage = docUrl
        ? `${message} See the list of available alternatives at ${docUrl}.`
        : message;
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: fullMessage
      });
    }
  }

  return result;
}
