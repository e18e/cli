import type {Message, Options, Stat} from './types.js';
import type {PackageModuleType} from './compute-type.js';

export type {Message, Options, PackageModuleType, Stat};

export type {
  ResolvedRuntimeTarget,
  RuntimePrimarySource,
  TargetRuntime
} from './targets/runtime-target.js';
export {parseTargetRuntime, TARGET_RUNTIMES} from './targets/runtime-target.js';
export {
  resolveRuntimeTarget,
  formatResolvedRuntimeTargetSummary
} from './targets/resolve-runtime-target.js';

export {report} from './analyze/report.js';

// Core modules - reusable logic for external tools
export * from './core/trust.js';
