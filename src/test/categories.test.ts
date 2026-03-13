import {describe, it, expect} from 'vitest';
import {parseCategories, VALID_CATEGORY_FLAGS} from '../categories.js';

describe('parseCategories', () => {
  it('returns all three categories when value is "all"', () => {
    expect(parseCategories('all')).toEqual([
      'native',
      'preferred',
      'micro-utilities'
    ]);
  });

  it('returns all three categories when value is undefined', () => {
    expect(parseCategories(undefined)).toEqual([
      'native',
      'preferred',
      'micro-utilities'
    ]);
  });

  it('returns a single category when value is one valid category', () => {
    expect(parseCategories('native')).toEqual(['native']);
    expect(parseCategories('preferred')).toEqual(['preferred']);
    expect(parseCategories('micro-utilities')).toEqual(['micro-utilities']);
  });

  it('normalizes to lowercase', () => {
    expect(parseCategories('NATIVE')).toEqual(['native']);
    expect(parseCategories('Preferred')).toEqual(['preferred']);
  });

  it('accepts comma-separated categories', () => {
    expect(parseCategories('native,preferred')).toEqual([
      'native',
      'preferred'
    ]);
    expect(parseCategories('native, preferred , micro-utilities')).toEqual([
      'native',
      'preferred',
      'micro-utilities'
    ]);
  });

  it('expands "all" when mixed with other categories', () => {
    expect(parseCategories('all,native')).toEqual([
      'native',
      'preferred',
      'micro-utilities'
    ]);
  });

  it('deduplicates when same category appears multiple times', () => {
    expect(parseCategories('native,native,preferred')).toEqual([
      'native',
      'preferred'
    ]);
  });

  it('throws on invalid category', () => {
    expect(() => parseCategories('invalid')).toThrow(
      'Invalid category "invalid". Must be one or more of: native, preferred, micro-utilities, all (comma-separated).'
    );
    expect(() => parseCategories('native,foo')).toThrow(
      'Invalid category "foo". Must be one or more of:'
    );
  });

  it('exports valid category flags', () => {
    expect(VALID_CATEGORY_FLAGS).toContain('native');
    expect(VALID_CATEGORY_FLAGS).toContain('preferred');
    expect(VALID_CATEGORY_FLAGS).toContain('micro-utilities');
    expect(VALID_CATEGORY_FLAGS).toContain('all');
  });
});
