import type {FileSystem} from './file-system.js';
import type {Message, Options, ReportPlugin, Stat, Stats} from './types.js';

interface PluginTiming {
  name: string;
  ms: number;
  error?: unknown;
}

interface RunPluginsResult {
  messages: Message[];
  stats: Stats;
  timings: PluginTiming[];
}

function defaultStats(): Stats {
  return {
    name: 'unknown',
    version: 'unknown',
    dependencyCount: {
      production: 0,
      development: 0,
      cjs: 0,
      esm: 0,
      duplicate: 0
    },
    extraStats: []
  };
}

export async function runPlugins(
  fileSystem: FileSystem,
  plugins: ReportPlugin[],
  options?: Options,
  baseStats?: Stats
): Promise<RunPluginsResult> {
  const messages: Message[] = [];
  const timings: PluginTiming[] = [];

  const extraStats: Stat[] = [...(baseStats?.extraStats ?? [])];
  const seenExtra = new Set<string>(extraStats.map((s) => s.name));

  let stats: Stats = baseStats
    ? {...baseStats, extraStats}
    : {...defaultStats(), extraStats};

  for (const plugin of plugins) {
    const label = plugin.name || 'anonymous';
    const start = Date.now();

    try {
      const res = await plugin(fileSystem, options);

      if (res.messages?.length) {
        messages.push(...res.messages);
      }

      if (res.stats) {
        stats = {
          ...stats,
          ...res.stats,
          extraStats
        };

        if (res.stats.extraStats?.length) {
          for (const st of res.stats.extraStats) {
            if (seenExtra.has(st.name)) continue;
            seenExtra.add(st.name);
            extraStats.push(st);
          }
        }
      }

      timings.push({name: label, ms: Date.now() - start});
    } catch (error) {
      timings.push({name: label, ms: Date.now() - start, error});
      throw error;
    }
  }

  return {messages, stats, timings};
}
