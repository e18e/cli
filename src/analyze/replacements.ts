import type {
  ManifestModule,
  ModuleReplacement,
  EngineConstraint,
  KnownUrl
} from 'module-replacements';
// enginematch@0.1.3 npm package `main` points at missing `lib/main.js`; use published entry under lib/src (see https://www.npmjs.com/package/enginematch).
import type {PackageJson} from 'enginematch/lib/src/main.js';
import {satisfies} from 'enginematch/lib/src/main.js';
import type {ReportPluginResult, AnalysisContext} from '../types.js';
import type {ResolvedRuntimeTarget} from '../targets/runtime-target.js';
import {fixableReplacements} from '../commands/fixable-replacements.js';
import {getPackageJson} from '../utils/package-json.js';
import {getManifestForCategories} from '../categories.js';
import {resolve, dirname, basename} from 'node:path';
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
      return `https://github.com/e18e/module-replacements/blob/main/docs/modules/${url.id}.md`;
  }
}

function getNodejsMinVersion(engines?: EngineConstraint[]): string | undefined {
  return engines?.find((e) => e.engine === 'nodejs')?.minVersion;
}

/** `PackageJson` for [enginematch](https://github.com/43081j/enginematch): effective browserslist from resolver precedence, then manifest. */
function toEngineMatchPackageJson(
  packageJson: NonNullable<Awaited<ReturnType<typeof getPackageJson>>>,
  resolved: ResolvedRuntimeTarget
): PackageJson {
  return {
    engines: packageJson.engines as Record<string, string> | undefined,
    browserslist: resolved.browserslistQueries ?? packageJson.browserslist
  };
}

function findFirstCompatibleReplacement(
  replacementIds: string[],
  defs: Record<string, ModuleReplacement>,
  pkg: PackageJson,
  root: string
): ModuleReplacement | undefined {
  for (const id of replacementIds) {
    const replacement = defs[id];
    if (!replacement) continue;

    const reqs = replacement.engines;
    if (reqs?.length) {
      if (!satisfies(pkg, {requirements: reqs, cwd: root})) {
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

  const baseManifest = getManifestForCategories(
    context.options?.categories ?? 'all'
  );

  // Custom mappings take precedence over built-in
  const allMappings = {
    ...baseManifest.mappings,
    ...customManifest.mappings
  };
  const allReplacementDefs: Record<string, ModuleReplacement> = {
    ...baseManifest.replacements,
    ...customManifest.replacements
  };

  const fixableByMigrate = new Set(fixableReplacements.map((r) => r.from));
  const enginesNode = packageJson.engines?.node;
  const pkgForEngines = toEngineMatchPackageJson(
    packageJson,
    context.resolvedRuntimeTarget
  );

  for (const name of Object.keys(packageJson.dependencies)) {
    const mapping = allMappings[name];
    if (!mapping?.replacements?.length) {
      continue;
    }

    const firstCompatible = findFirstCompatibleReplacement(
      mapping.replacements,
      allReplacementDefs,
      pkgForEngines,
      context.root
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
        const nodeVersion = getNodejsMinVersion(firstCompatible.engines);
        const requires =
          nodeVersion && !enginesNode
            ? ` Required Node >= ${nodeVersion}.`
            : '';
        const urlStr = resolveUrl(firstCompatible.url);
        message = `Module "${name}" can be replaced with native functionality.${requires} You can read more at ${urlStr}.`;
        break;
      }
      case 'documented':
        message = `Module "${name}" can be replaced with a more performant alternative.`;
        break;
      default:
        message = `Module "${name}" can be replaced with a more performant alternative.`;
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
