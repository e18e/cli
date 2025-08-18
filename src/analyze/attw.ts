import {ReportPluginResult} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';

export async function runAttw(
  fileSystem: FileSystem
): Promise<ReportPluginResult> {
  const result: ReportPluginResult = {
    messages: []
  };

  // Only support tarballs for now
  if (!(fileSystem instanceof TarballFileSystem)) {
    return result;
  }

  const {checkPackage, createPackageFromTarballData} = await import(
    '@arethetypeswrong/core'
  );
  const {groupProblemsByKind} = await import('@arethetypeswrong/core/utils');
  const {filterProblems, problemKindInfo} = await import(
    '@arethetypeswrong/core/problems'
  );

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
              resolutionKind: resolutionKind as any,
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
