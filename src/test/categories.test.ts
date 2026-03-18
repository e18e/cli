import {describe, it, expect} from 'vitest';
import {
  parseCategories,
  getManifestForCategories,
  VALID_CATEGORIES
} from '../categories.js';

describe('parseCategories', () => {
  it('returns "all" for undefined', () => {
    expect(parseCategories(undefined)).toBe('all');
  });

  it('returns "all" for empty string', () => {
    expect(parseCategories('')).toBe('all');
  });

  it('returns "all" for whitespace-only string', () => {
    expect(parseCategories('   ')).toBe('all');
  });

  it('returns "all" for literal "all"', () => {
    expect(parseCategories('all')).toBe('all');
  });

  it('returns "all" for "all" with whitespace', () => {
    expect(parseCategories('  all  ')).toBe('all');
  });

  it('returns single category as Set', () => {
    expect(parseCategories('native')).toEqual(new Set(['native']));
    expect(parseCategories('preferred')).toEqual(new Set(['preferred']));
    expect(parseCategories('micro-utilities')).toEqual(
      new Set(['micro-utilities'])
    );
  });

  it('returns multiple categories for comma-separated list', () => {
    expect(parseCategories('native,preferred')).toEqual(
      new Set(['native', 'preferred'])
    );
    expect(parseCategories('native, preferred , micro-utilities')).toEqual(
      new Set(['native', 'preferred', 'micro-utilities'])
    );
  });

  it('deduplicates categories', () => {
    expect(parseCategories('native,native,preferred')).toEqual(
      new Set(['native', 'preferred'])
    );
  });

  it('throws for invalid category', () => {
    expect(() => parseCategories('foo')).toThrow(
      /Invalid categories: foo\. Valid values are:/
    );
    expect(() => parseCategories('foo')).toThrow(
      new RegExp(VALID_CATEGORIES.join(', '))
    );
  });

  it('throws for invalid category in comma-separated list', () => {
    expect(() => parseCategories('native,invalid,preferred')).toThrow(
      /Invalid categories: invalid\. Valid values are:/
    );
  });

  it('treats empty segments after split as omitted', () => {
    expect(parseCategories('native,,preferred')).toEqual(
      new Set(['native', 'preferred'])
    );
  });
});

describe('getManifestForCategories', () => {
  it('returns merged manifest for "all"', () => {
    const manifest = getManifestForCategories('all');
    expect(manifest).toHaveProperty('mappings');
    expect(manifest).toHaveProperty('replacements');
    expect(Object.keys(manifest.mappings).length).toBeGreaterThan(0);
    expect(Object.keys(manifest.replacements).length).toBeGreaterThan(0);
  });

  it('returns manifest for single category', () => {
    const nativeManifest = getManifestForCategories(new Set(['native']));
    expect(nativeManifest).toHaveProperty('mappings');
    expect(nativeManifest).toHaveProperty('replacements');
    expect(Object.keys(nativeManifest.mappings).length).toBeGreaterThanOrEqual(
      0
    );
  });

  it('returns merged manifest for multiple categories', () => {
    const manifest = getManifestForCategories(new Set(['native', 'preferred']));
    expect(manifest).toHaveProperty('mappings');
    expect(manifest).toHaveProperty('replacements');
    const allManifest = getManifestForCategories('all');
    expect(Object.keys(manifest.mappings).length).toBeLessThanOrEqual(
      Object.keys(allManifest.mappings).length
    );
  });
});
