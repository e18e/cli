import {
  checkPackage,
  createPackageFromTarballData,
  ResolutionKind
} from '@arethetypeswrong/core';
import {groupProblemsByKind} from '@arethetypeswrong/core/utils';
import {filterProblems, problemKindInfo} from '@arethetypeswrong/core/problems';
import {ReportPluginResult} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';

export async function runAttw(
  fileSystem: FileSystem
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  // Only run attw when TypeScript is configured
  const hasTypeScriptConfig = await fileSystem.fileExists('/tsconfig.json');
  if (!hasTypeScriptConfig) {
    return result;
  }

  // Only support tarballs for now
  if (!(fileSystem instanceof TarballFileSystem)) {
    return result;
  }

  const pkg = createPackageFromTarballData(new Uint8Array(fileSystem.tarball));
  const attwResult = await checkPackage(pkg);

  if (attwResult.types === false) {
    result.messages.push({
      severity: 'suggestion',
      score: 0,
      message: `No type definitions found.`
    });
  } else {
    const subpaths = Object.keys(attwResult.entrypoints);

    for (const subpath of subpaths) {
      const resolutions = attwResult.entrypoints[subpath].resolutions;

      for (const resolutionKind in resolutions) {
        const problemsForMatrix = Object.entries(
          groupProblemsByKind(
            filterProblems(attwResult, {
              resolutionKind: resolutionKind as ResolutionKind,
              entrypoint: subpath
            })
          )
        );
        for (const [_kind, problems] of problemsForMatrix) {
          for (const problem of problems) {
            result.messages.push({
              severity: 'error',
              score: 0,
              message:
                `"${subpath}" subpath: ` +
                problemKindInfo[problem.kind].description
            });
          }
        }
      }
    }
  }

  return result;
}
