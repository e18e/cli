import {
  checkPackage,
  createPackageFromTarballData,
  ResolutionKind
} from '@arethetypeswrong/core';
import {groupProblemsByKind} from '@arethetypeswrong/core/utils';
import {filterProblems, problemKindInfo} from '@arethetypeswrong/core/problems';
import {Message} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';

export async function runAttw(fileSystem: FileSystem) {
  const messages: Message[] = [];

  // Only support tarballs for now
  if (!(fileSystem instanceof TarballFileSystem)) {
    return messages;
  }

  const pkg = createPackageFromTarballData(new Uint8Array(fileSystem.tarball));
  const result = await checkPackage(pkg);

  if (result.types === false) {
    messages.push({
      severity: 'suggestion',
      score: 0,
      message: `No type definitions found.`
    });
  } else {
    const subpaths = Object.keys(result.entrypoints);

    for (const subpath of subpaths) {
      const resolutions = result.entrypoints[subpath].resolutions;

      for (const resolutionKind in resolutions) {
        const problemsForMatrix = Object.entries(
          groupProblemsByKind(
            filterProblems(result, {
              resolutionKind: resolutionKind as ResolutionKind,
              entrypoint: subpath
            })
          )
        );
        for (const [_kind, problems] of problemsForMatrix) {
          for (const problem of problems) {
            messages.push({
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

  return messages;
}
