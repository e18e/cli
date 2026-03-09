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

function findFirstCompatibleReplacement(
  replacementIds: string[],
  defs: Record<string, ModuleReplacement>,
  enginesNode: string | undefined
): ModuleReplacement | undefined {
  for (const id of replacementIds) {
    const replacement = defs[id];
    if (!replacement) continue;

    if (replacement.type === 'native' && enginesNode) {
      const nodeVersion = getNodeMinVersion(replacement.engines);
      if (nodeVersion && !isNodeEngineCompatible(nodeVersion, enginesNode)) {
        continue;
      }
    }

    return replacement;
  }
  return undefined;
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
  const enginesNode = packageJson.engines?.node;

  for (const name of Object.keys(packageJson.dependencies)) {
    const mapping = allMappings[name];
    if (!mapping?.replacements?.length) {
      continue;
    }

    const firstCompatible = findFirstCompatibleReplacement(
      mapping.replacements,
      allReplacementDefs,
      enginesNode
    );
    if (!firstCompatible) {
      continue;
    }

    const fixableBy = fixableByMigrate.has(name) ? 'migrate' : undefined;
    const mappingUrl = mapping.url ? resolveUrl(mapping.url) : undefined;

    let message: string;
    switch (firstCompatible.type) {
      case 'removal':
        message = `Module "${name}" can be removed, and native functionality used instead`;
        break;
      case 'simple':
        message = `Module "${name}" can be replaced with inline native syntax. ${firstCompatible.description}.`;
        break;
      case 'native': {
        const nodeVersion = getNodeMinVersion(firstCompatible.engines);
        const requires =
          nodeVersion && !enginesNode
            ? ` Required Node >= ${nodeVersion}.`
            : '';
        const urlStr = resolveUrl(firstCompatible.url);
        message = `Module "${name}" can be replaced with native functionality.${requires} You can read more at ${urlStr}.`;
        break;
      }
      case 'documented':
        if (firstCompatible.replacementModule) {
          message = `Module "${name}" can be replaced. We recommend switching to "${firstCompatible.replacementModule}".`;
        } else {
          const urlStr = resolveUrl(firstCompatible.url);
          message = `Module "${name}" can be replaced with a more performant alternative. See the list of available alternatives at ${urlStr}.`;
        }
        break;
      default:
        message = `Module "${name}" can be replaced.`;
    }
    if (mappingUrl) {
      message += ` See more at ${mappingUrl}.`;
    }
    result.messages.push({
      severity: 'warning',
      score: 0,
      message,
      ...(fixableBy && {fixableBy})
    });
  }

  return result;
}
