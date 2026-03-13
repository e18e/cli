import * as replacements from 'module-replacements';
import type {ModuleReplacement} from 'module-replacements';

export type CategoryFlag = 'native' | 'preferred' | 'micro-utilities' | 'all';
export type Category = Exclude<CategoryFlag, 'all'>;

export type ManifestByCategory = Record<
  Category,
  {moduleReplacements: ModuleReplacement[]}
>;

export function getManifestByCategory(): ManifestByCategory {
  return {
    native: replacements.nativeReplacements,
    preferred: replacements.preferredReplacements,
    'micro-utilities': replacements.microUtilsReplacements
  };
}

export const VALID_CATEGORY_FLAGS: readonly CategoryFlag[] = [
  'native',
  'preferred',
  'micro-utilities',
  'all'
];

const ALL_CATEGORIES: readonly Category[] = [
  'native',
  'preferred',
  'micro-utilities'
];

export function parseCategories(value: string | undefined): Category[] {
  const raw = (value ?? 'all').trim().toLowerCase();
  if (!raw) {
    return [...ALL_CATEGORIES];
  }

  const tokens = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const hasAll = tokens.includes('all');
  const categories = hasAll
    ? [...ALL_CATEGORIES]
    : (tokens as CategoryFlag[]).filter((t) => t !== 'all');

  for (const t of categories) {
    if (!VALID_CATEGORY_FLAGS.includes(t)) {
      throw new Error(
        `Invalid category "${t}". Must be one or more of: native, preferred, micro-utilities, all (comma-separated).`
      );
    }
  }

  return hasAll ? [...ALL_CATEGORIES] : [...new Set(categories as Category[])];
}
