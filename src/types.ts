import {codemods} from 'module-replacements-codemods';

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

export interface Stat {
  type: 'stat';
  name: string;
  value: string;
  label?: string;
}

export interface Message {
  type: 'message';
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
