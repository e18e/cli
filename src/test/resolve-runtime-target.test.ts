import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createTempDir, cleanupTempDir} from './utils.js';
import {
  resolveRuntimeTarget,
  formatResolvedRuntimeTargetSummary
} from '../targets/resolve-runtime-target.js';
import {parseTargetRuntime} from '../targets/runtime-target.js';

describe('resolveRuntimeTarget', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('uses default when no engines, browserslist, or CLI override', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({name: 'p', version: '1.0.0'})
    );

    const r = resolveRuntimeTarget({
      root: tempDir,
      packageFile: {name: 'p', version: '1.0.0'}
    });

    expect(r.primarySource).toBe('default');
    expect(r.runtime).toBe('nodejs');
    expect(r.browserslistQueries).toBeUndefined();
    expect(r.nodeRange).toBeUndefined();
  });

  it('uses engines.node when no browserslist config', async () => {
    const pkg = {
      name: 'p',
      version: '1.0.0',
      engines: {node: '>=18'}
    };
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg));

    const r = resolveRuntimeTarget({
      root: tempDir,
      packageFile: pkg
    });

    expect(r.primarySource).toBe('engines-node');
    expect(r.runtime).toBe('nodejs');
    expect(r.nodeRange).toBe('>=18');
    expect(r.browserslistQueries).toBeUndefined();
  });

  it('loads browserslist from package.json and infers browser runtime', async () => {
    const pkg = {
      name: 'p',
      version: '1.0.0',
      browserslist: ['defaults']
    };
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg));

    const r = resolveRuntimeTarget({
      root: tempDir,
      packageFile: pkg
    });

    expect(r.primarySource).toBe('project-browserslist');
    expect(r.runtime).toBe('browser');
    expect(r.browserslistQueries).toBeDefined();
    expect(r.browserslistQueries?.length).toBeGreaterThan(0);
  });

  it('CLI browserslist query wins over project config', async () => {
    const pkg = {
      name: 'p',
      version: '1.0.0',
      browserslist: ['defaults']
    };
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg));

    const r = resolveRuntimeTarget({
      root: tempDir,
      packageFile: pkg,
      browserslistQuery: 'baseline widely available'
    });

    expect(r.primarySource).toBe('cli-browserslist');
    expect(r.browserslistQueries).toEqual(['baseline widely available']);
    expect(r.runtime).toBe('browser');
  });

  it('respects explicit CLI runtime over inference', async () => {
    const pkg = {name: 'p', version: '1.0.0', browserslist: ['defaults']};
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg));

    const r = resolveRuntimeTarget({
      root: tempDir,
      packageFile: pkg,
      runtime: 'nodejs'
    });

    expect(r.primarySource).toBe('project-browserslist');
    expect(r.runtime).toBe('nodejs');
  });
});

describe('formatResolvedRuntimeTargetSummary', () => {
  it('formats default and engines-node cases', () => {
    expect(
      formatResolvedRuntimeTargetSummary({
        runtime: 'nodejs',
        primarySource: 'default',
        browserslistQueries: undefined,
        nodeRange: undefined
      })
    ).toContain('default');

    expect(
      formatResolvedRuntimeTargetSummary({
        runtime: 'nodejs',
        primarySource: 'engines-node',
        browserslistQueries: undefined,
        nodeRange: '>=20'
      })
    ).toContain('engines.node');
    expect(
      formatResolvedRuntimeTargetSummary({
        runtime: 'nodejs',
        primarySource: 'engines-node',
        browserslistQueries: undefined,
        nodeRange: '>=20'
      })
    ).toContain('>=20');
  });

  it('formats browserslist cases', () => {
    expect(
      formatResolvedRuntimeTargetSummary({
        runtime: 'browser',
        primarySource: 'cli-browserslist',
        browserslistQueries: ['baseline widely available'],
        nodeRange: undefined
      })
    ).toMatch(/CLI Browserslist/);

    expect(
      formatResolvedRuntimeTargetSummary({
        runtime: 'browser',
        primarySource: 'project-browserslist',
        browserslistQueries: ['defaults'],
        nodeRange: undefined
      })
    ).toMatch(/Browserslist/);
  });
});

describe('parseTargetRuntime', () => {
  it('returns undefined for empty input', () => {
    expect(parseTargetRuntime(undefined)).toBeUndefined();
    expect(parseTargetRuntime('')).toBeUndefined();
  });

  it('parses valid runtimes', () => {
    expect(parseTargetRuntime('browser')).toBe('browser');
    expect(parseTargetRuntime('nodejs')).toBe('nodejs');
  });

  it('throws on invalid runtime', () => {
    expect(() => parseTargetRuntime('nope')).toThrow(/Invalid --runtime/);
  });
});
