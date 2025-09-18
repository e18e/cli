import { runDependencyAnalysis as runOldAnalysis } from './src/analyze/dependencies_old.js';
import { runDependencyAnalysis as runNewAnalysis } from './src/analyze/dependencies_one_more_time.js';
import { LocalFileSystem } from './src/local-file-system.js';

async function run() {
  const fileSystem = new LocalFileSystem(process.cwd());

  // console.log('Running old algorithm...');
  // const oldResult = await runOldAnalysis(fileSystem);
  // console.log('Old result:', oldResult.stats);

  console.log('\nRunning new algorithm...');
  const newResult = await runNewAnalysis(fileSystem);
  console.log('New result:', newResult.stats);
}

run().catch(console.error);
