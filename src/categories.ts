import type {ManifestModule} from 'module-replacements';
import {
  nativeReplacements,
  preferredReplacements,
  microUtilsReplacements,
  all
} from 'module-replacements';

export const VALID_CATEGORIES = [
  'native',
  'preferred',
  'micro-utilities',
  'all'
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

export type CategoryKey = Exclude<Category, 'all'>;

export type ParsedCategories = 'all' | CategoryKey[];

export function parseCategories(raw: string | undefined): ParsedCategories {
  const normalized = raw?.trim() ?? '';
  if (normalized === '' || normalized === 'all') {
    return 'all';
  }

  const segments = normalized.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) {
    return 'all';
  }

  const invalid: string[] = [];
  const parsed: CategoryKey[] = [];

  for (const segment of segments) {
    if (segment === 'all') {
      return 'all';
    }
    if (VALID_CATEGORIES.includes(segment as Category)) {
      const key = segment as CategoryKey;
      if (!parsed.includes(key)) {
        parsed.push(key);
      }
    } else {
      invalid.push(segment);
    }
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid categories: ${invalid.join(', ')}. Valid values are: ${VALID_CATEGORIES.join(', ')}.`
    );
  }

  return parsed;
}

const MANIFEST_BY_CATEGORY: Record<CategoryKey, ManifestModule> = {
  native: nativeReplacements,
  preferred: preferredReplacements,
  'micro-utilities': microUtilsReplacements
};

export function getManifestForCategories(
  parsed: ParsedCategories
): ManifestModule {
  if (parsed === 'all') {
    return all;
  }

  const manifest: ManifestModule = {
    mappings: {},
    replacements: {}
  };

  for (const cat of parsed) {
    const m = MANIFEST_BY_CATEGORY[cat];
    Object.assign(manifest.mappings, m.mappings);
    Object.assign(manifest.replacements, m.replacements);
  }

  return manifest;
}
