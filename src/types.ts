import {codemods} from 'module-replacements-codemods';
import type {FileSystem} from './file-system.js';

export type PackType =
  | 'auto'
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'none'
  | {tarball: ArrayBuffer};

export interface Options {
  root?: string;
  pack?: PackType;
  manifest?: string[];
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
  factory: (typeof codemods)[keyof typeof codemods];
}

export interface ReportPluginResult {
  stats?: Stats;
  messages: Message[];
}

export type ReportPlugin = (
  fileSystem: FileSystem,
  options?: Options
) => Promise<ReportPluginResult>;
