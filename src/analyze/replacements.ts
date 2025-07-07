import * as replacements from 'module-replacements';
import {Message, PackageJsonLike} from '../types.js';
import type {FileSystem} from '../file-system.js';

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

export async function runReplacements(fileSystem: FileSystem) {
  const messages: Message[] = [];

  let packageJsonText: string;

  try {
    packageJsonText = await fileSystem.readFile('/package.json');
  } catch {
    // No package.json found
    return messages;
  }

  let packageJson: PackageJsonLike;

  try {
    packageJson = JSON.parse(packageJsonText);
  } catch {
    // Not parseable
    return messages;
  }

  if (!packageJson.dependencies) {
    // No dependencies
    return messages;
  }

  for (const name of Object.keys(packageJson.dependencies)) {
    const replacement = replacements.all.moduleReplacements.find(
      (replacement) => replacement.moduleName === name
    );

    if (!replacement) {
      continue;
    }

    if (replacement.type === 'none') {
      messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be removed, and native functionality used instead`
      });
    } else if (replacement.type === 'simple') {
      messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be replaced. ${replacement.replacement}.`
      });
    } else if (replacement.type === 'native') {
      const mdnPath = getMdnUrl(replacement.mdnPath);
      // TODO (43081j): support `nodeVersion` here, check it against the
      // packageJson.engines field, if there is one.
      messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be replaced with native functionality. Use "${replacement.replacement}" instead. You can read more at ${mdnPath}.`
      });
    } else if (replacement.type === 'documented') {
      const docUrl = getDocsUrl(replacement.docPath);
      messages.push({
        severity: 'warning',
        score: 0,
        message: `Module "${name}" can be replaced with a more performant alternative. See the list of available alternatives at ${docUrl}.`
      });
    }
  }

  return messages;
}
