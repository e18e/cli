import * as replacements from 'module-replacements';
import type {
  ManifestModule,
  ModuleReplacement,
  EngineConstraint,
  KnownUrl
} from 'module-replacements';
import type {ReportPluginResult, AnalysisContext} from '../types.js';
import {fixableReplacements} from '../commands/fixable-replacements.js';
import {getPackageJson} from '../utils/package-json.js';
import {resolve, dirname, basename} from 'node:path';
import {
  satisfies as semverSatisfies,
  ltr as semverLessThan,
  minVersion,
  validRange
} from 'semver';
import {LocalFileSystem} from '../local-file-system.js';

/**
 * Resolves a v3 KnownUrl to a full URL string.
 */
export function resolveUrl(url: KnownUrl): string {
  if (typeof url === 'string') return url;
  switch (url.type) {
    case 'mdn':
      return `https://developer.mozilla.org/en-US/docs/${url.id}`;
    case 'node':
      return `https://nodejs.org/docs/latest/${url.id}`;
    case 'e18e':
      return `https://github.com/es-tooling/module-replacements/blob/main/docs/modules/${url.id}.md`;
  }
}

function getNodeMinVersion(engines?: EngineConstraint[]): string | undefined {
  return engines?.find((e) => e.engine === 'nodejs')?.minVersion;
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

async function loadCustomManifests(
  manifestPaths: string[]
): Promise<ManifestModule> {
  const result: ManifestModule = {
    mappings: {},
    replacements: {}
  };

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

      if (manifest.mappings) {
        Object.assign(result.mappings, manifest.mappings);
      }
      if (manifest.replacements) {
        Object.assign(result.replacements, manifest.replacements);
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to load custom manifest from ${manifestPath}: ${error}`
      );
    }
  }

  return result;
}

export async function runReplacements(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  const packageJson = await getPackageJson(context.fs);

  if (!packageJson || !packageJson.dependencies) {
    return result;
  }

  const customManifest = context.options?.manifest
    ? await loadCustomManifests(context.options.manifest)
    : {mappings: {}, replacements: {}};

  // Custom mappings take precedence over built-in
  const allMappings = {
    ...replacements.all.mappings,
    ...customManifest.mappings
  };
  const allReplacementDefs: Record<string, ModuleReplacement> = {
    ...replacements.all.replacements,
    ...customManifest.replacements
  };

  const fixableByMigrate = new Set(fixableReplacements.map((r) => r.from));

  for (const name of Object.keys(packageJson.dependencies)) {
    const mapping = allMappings[name];
    if (!mapping) {
      continue;
    }

    const replacementIds = mapping.replacements;
    if (!replacementIds || replacementIds.length === 0) {
      continue;
    }

    const replacement = allReplacementDefs[replacementIds[0]];
    if (!replacement) {
      continue;
    }

    const fixableBy = fixableByMigrate.has(name) ? 'migrate' : undefined;

    if (replacement.type === 'removal') {
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be removed, and native functionality used instead`,
        ...(fixableBy && {fixableBy})
      });
    } else if (replacement.type === 'simple') {
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be replaced. ${replacement.description}.`,
        ...(fixableBy && {fixableBy})
      });
    } else if (replacement.type === 'native') {
      const enginesNode = packageJson.engines?.node;
      const nodeVersion = getNodeMinVersion(replacement.engines);
      let supported = true;

      if (nodeVersion && enginesNode) {
        supported = isNodeEngineCompatible(nodeVersion, enginesNode);
      }

      if (!supported) {
        continue;
      }

      const urlStr = resolveUrl(replacement.url);
      const requires =
        nodeVersion && !enginesNode ? ` Required Node >= ${nodeVersion}.` : '';
      const description = replacement.description ?? replacement.id;
      const message = `Module "${name}" can be replaced with native functionality. Use "${description}" instead.${requires}`;
      const fullMessage = `${message} You can read more at ${urlStr}.`;
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: fullMessage,
        ...(fixableBy && {fixableBy})
      });
    } else if (replacement.type === 'documented') {
      const urlStr = resolveUrl(replacement.url);
      const message = `Module "${name}" can be replaced with a more performant alternative.`;
      const fullMessage = `${message} See the list of available alternatives at ${urlStr}.`;
      result.messages.push({
        severity: 'warning',
        score: 0,
        message: fullMessage,
        ...(fixableBy && {fixableBy})
      });
    }
  }

  return result;
}
