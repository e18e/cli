export const isWindows = typeof process !== 'undefined' && process.platform === 'win32';

const backslashRegex = /\\/g;

function slash(path: string): string {
  return path.replace(backslashRegex, '/');
}

export function normalizePath(id: string): string {
  return require('node:path').posix.normalize(isWindows ? slash(id) : id);
}
