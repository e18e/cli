import {describe, it, expect} from 'vitest';
import {runPlugins} from '../plugin-runner.js';
import type {FileSystem} from '../file-system.js';
import type {ReportPlugin, Stats, Message} from '../types.js';

const fsMock: FileSystem = {
  getRootDir: async () => '/',
  listPackageFiles: async () => [],
  readFile: async () => '',
  getInstallSize: async () => 0,
  fileExists: async () => false
};

const depCounts = {production: 0, development: 0, cjs: 0, esm: 0, duplicate: 0};

describe('runPlugins', () => {
  it('should aggregate messages and merge stats with extraStats de-dup', async () => {
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

    const stats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts,
      extraStats: [{name: 'seed', value: 'seed'}]
    };
    const messages: Message[] = [];

    await runPlugins(fsMock, [pluginA, pluginB, pluginC], stats, messages);

    expect(messages.map((m) => m.message)).toEqual(['A', 'B', 'C']);
    expect(stats.name).toBe('pkg-b');
    expect(stats.version).toBe('2.0.0');

    const names = stats.extraStats?.map((s) => s.name) ?? [];

    expect(new Set(names)).toEqual(new Set(['seed', 's1', 's2']));
    expect(names.filter((n) => n === 's1').length).toBe(1);
  });

  it('should use shared extraStats array and preserve seed when no plugin stats', async () => {
    const stats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts,
      extraStats: [{name: 'seed', value: 'seed'}]
    };
    const messages: Message[] = [];

    const noop: ReportPlugin = async () => ({messages: []});

    await runPlugins(fsMock, [noop], stats, messages);

    expect(stats.extraStats).toBe(stats.extraStats);
    expect(stats.extraStats?.map((s) => s.name)).toEqual(['seed']);
    expect(stats.extraStats?.map((s) => s.name)).toEqual(['seed']);
  });

  it('should propagate plugin errors', async () => {
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
      runPlugins(
        fsMock,
        [ok, boom],
        {
          name: 'unknown',
          version: 'unknown',
          dependencyCount: depCounts,
          extraStats: []
        },
        []
      )
    ).rejects.toThrow('boom');
  });

  it('should return provided baseStats when plugins only emit messages', async () => {
    const onlyMsgs: ReportPlugin = async () => ({
      messages: [{severity: 'warning', score: 0, message: 'M'}]
    });

    const stats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts,
      extraStats: []
    };
    const messages: Message[] = [];

    await runPlugins(fsMock, [onlyMsgs], stats, messages);

    expect(messages).toHaveLength(1);
    expect(stats.name).toBe('unknown');
    expect(stats.version).toBe('unknown');
    expect(stats.dependencyCount).toEqual(depCounts);
    expect(stats.extraStats).toEqual([]);
  });

  it('should merge stats when plugin provides stats without extraStats', async () => {
    const plugin: ReportPlugin = async () => ({
      messages: [],
      stats: {
        name: 'p',
        version: '1',
        dependencyCount: depCounts
      }
    });

    const stats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts
    };
    const messages: Message[] = [];

    await runPlugins(fsMock, [plugin], stats, messages);
    expect(stats.name).toBe('p');
    expect(stats.version).toBe('1');
    expect(stats.extraStats).toEqual(undefined);
  });

  it('should handle empty plugin list', async () => {
    const stats: Stats = {
      name: 'unknown',
      version: 'unknown',
      dependencyCount: depCounts,
      extraStats: []
    };
    const messages: Message[] = [];

    await runPlugins(fsMock, [], stats, messages);
    expect(messages).toEqual([]);
    expect(stats.name).toBe('unknown');
    expect(stats.extraStats).toEqual([]);
  });
});
