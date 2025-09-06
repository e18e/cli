import {describe, it, expect} from 'vitest';
import {runPlugins} from '../plugin-runner.js';
import type {FileSystem} from '../file-system.js';
import type {ReportPlugin, Stats} from '../types.js';

const fsMock: FileSystem = {
  getRootDir: async () => '/',
  listPackageFiles: async () => [],
  readFile: async () => '',
  getInstallSize: async () => 0,
  fileExists: async () => false
};

const depCounts = {production: 0, development: 0, cjs: 0, esm: 0, duplicate: 0};

describe('plugin-runner', () => {
  it('aggregates messages and merges stats with extraStats de-dup', async () => {
    const pluginA: ReportPlugin = async () => ({
      messages: [{severity: 'warning', score: 0, message: 'A'}],
      stats: {
        name: 'pkg-a',
        version: '1.0.0',
        dependencyCount: depCounts,
        extraStats: [{name: 's1', value: 'v1'}]
      }
    });

    const pluginB: ReportPlugin = async () => ({
      messages: [{severity: 'suggestion', score: 0, message: 'B'}],
      stats: {
        name: 'pkg-b',
        version: '2.0.0',
        dependencyCount: depCounts,
        extraStats: [
          {name: 's1', value: 'v1-dup'},
          {name: 's2', value: 'v2'}
        ]
      }
    });

    const pluginC: ReportPlugin = async () => ({
      messages: [{severity: 'error', score: 0, message: 'C'}]
    });

    const baseStats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts,
      extraStats: [{name: 'seed', value: 'seed'}]
    };

    const {messages, stats, timings} = await runPlugins(
      fsMock,
      [pluginA, pluginB, pluginC],
      undefined,
      baseStats
    );

    expect(messages.map((m) => m.message)).toEqual(['A', 'B', 'C']);

    expect(stats.name).toBe('pkg-b');
    expect(stats.version).toBe('2.0.0');

    const names = stats.extraStats?.map((s) => s.name) ?? [];
    expect(new Set(names)).toEqual(new Set(['seed', 's1', 's2']));
    expect(names.filter((n) => n === 's1').length).toBe(1);

    expect(timings).toHaveLength(3);
    for (const t of timings) {
      expect(typeof t.name).toBe('string');
      expect(t.ms).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not mutate extraStats and uses a shared extraStats for aggregation', async () => {
    const baseStats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts,
      extraStats: [{name: 'seed', value: 'seed'}]
    };

    const noop: ReportPlugin = async () => ({messages: []});

    const {stats} = await runPlugins(fsMock, [noop], undefined, baseStats);

    expect(stats.extraStats).not.toBe(baseStats.extraStats);
    expect(stats.extraStats?.map((s) => s.name)).toContain('seed');
    expect(baseStats.extraStats?.map((s) => s.name)).toEqual(['seed']);
  });

  it('propagates errors from plugins', async () => {
    const ok: ReportPlugin = async () => ({
      messages: [{severity: 'warning', score: 0, message: 'ok'}],
      stats: {
        name: 'n',
        version: 'v',
        dependencyCount: depCounts,
        extraStats: []
      }
    });

    const boom: ReportPlugin = async () => {
      throw new Error('boom');
    };

    await expect(
      runPlugins(fsMock, [ok, boom], undefined, {
        name: 'unknown',
        version: 'unknown',
        dependencyCount: depCounts,
        extraStats: []
      })
    ).rejects.toThrow('boom');
  });

  it('returns default stats when no baseStats provided', async () => {
    const onlyMsgs: ReportPlugin = async () => ({
      messages: [{severity: 'warning', score: 0, message: 'M'}]
    });
    const {stats, messages} = await runPlugins(fsMock, [onlyMsgs]);

    expect(messages).toHaveLength(1);
    expect(stats.name).toBe('unknown');
    expect(stats.version).toBe('unknown');
    expect(stats.dependencyCount).toEqual(depCounts);
    expect(stats.extraStats).toEqual([]);
  });

  it('merges stats when plugin provides stats without extraStats', async () => {
    const plugin: ReportPlugin = async () => ({
      messages: [],
      stats: {
        name: 'p',
        version: '1',
        dependencyCount: depCounts
        // extraStats intentionally omitted
      }
    });
    const {stats} = await runPlugins(fsMock, [plugin]);
    expect(stats.name).toBe('p');
    expect(stats.extraStats).toEqual([]);
  });

  it('handles empty plugin list', async () => {
    const {messages, stats, timings} = await runPlugins(fsMock, []);
    expect(messages).toEqual([]);
    expect(timings).toEqual([]);
    expect(stats.name).toBe('unknown');
    expect(stats.extraStats).toEqual([]);
  });
});
