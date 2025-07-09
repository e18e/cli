import {codemods} from 'module-replacements-codemods';
import type {FileSystem} from './file-system.js';

export interface PackFile {
  name: string;
  data: string | ArrayBuffer | Uint8Array;
}

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
}

export interface StatLike<T> {
  name: string;
  label?: string;
  value: T;
}

export type Stat = StatLike<number> | StatLike<string>;

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
}

export interface Replacement {
  from: string;
  to: string;
  condition?: (filename: string, source: string) => Promise<boolean>;
  factory: (typeof codemods)[keyof typeof codemods];
}

export interface ReportPluginResult {
  stats?: Stat[];
  messages: Message[];
}

export type ReportPlugin = (
  fileSystem: FileSystem
) => Promise<ReportPluginResult>;
