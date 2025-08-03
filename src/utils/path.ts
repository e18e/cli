export function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}
