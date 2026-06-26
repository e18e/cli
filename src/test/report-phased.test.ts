import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {report, ANALYSIS_PLUGINS} from '../analyze/report.js';
import {createTempDir, cleanupTempDir, createTestPackage} from './utils.js';

let tempDir: string;

beforeAll(async () => {
  tempDir = await createTempDir();
  await createTestPackage(tempDir, {
    name: 'mock-package',
    version: '1.0.0',
    type: 'module',
    main: 'index.js'
  });
});

afterAll(async () => {
  await cleanupTempDir(tempDir);
});

describe('report phased execution', () => {
  it('runs phases in order when phased runner is provided', async () => {
    const executed: Array<{id: string; title: string}> = [];

    await report({
      root: tempDir,
      phased: async (phases) => {
        for (const phase of phases) {
          executed.push({id: phase.id, title: phase.title});
          await phase.run();
        }
      }
    });

    expect(executed).toEqual([
      {id: 'setup', title: 'Loading project files'},
      ...ANALYSIS_PLUGINS.map(({id, title}) => ({id, title}))
    ]);
  });

  it('returns the same shape without a phased runner', async () => {
    const result = await report({root: tempDir});

    expect(result).toMatchObject({
      info: {
        name: 'mock-package',
        version: '1.0.0'
      },
      stats: {
        name: 'mock-package',
        version: '1.0.0'
      },
      messages: expect.any(Array)
    });
  });
});
