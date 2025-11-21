import type {FileSystem} from './file-system.js';
import type {Codemod, CodemodOptions} from 'module-replacements-codemods';
import type {ParsedLockFile} from 'lockparse';

export interface Options {
  root?: string;
  manifest?: string[];
  baseTarball?: string[];
  targetTarball?: string[];
}

export interface StatLike<T> {
  name: string;
  label?: string;
  value: T;
}

export type Stat = StatLike<number> | StatLike<string>;

export interface Stats {
  name: string;
  version: string;
  installSize?: number;
  dependencyCount: {
    production: number;
    development: number;
    cjs: number;
    esm: number;
    duplicate: number;
  };
  extraStats?: Stat[];
}

export interface Message {
  severity: 'error' | 'warning' | 'suggestion';
  score: number;
  message: string;
}

export interface PackageJsonLike {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: {
    node?: string;
    [engineName: string]: string | undefined;
  };
}

export interface Replacement {
  from: string;
  to: string;
  condition?: (filename: string, source: string) => Promise<boolean>;
  factory: (options: CodemodOptions) => Codemod;
}

export interface ReportPluginResult {
  stats?: Stats;
  messages: Message[];
}

export type ReportPlugin = (
  context: AnalysisContext
) => Promise<ReportPluginResult>;

export interface AnalysisContext {
  fs: FileSystem;
  root: string;
  options?: Options;
  lockfile: ParsedLockFile;
  packageFile: PackageJsonLike;
  stats: Stats;
  messages: Message[];
}
