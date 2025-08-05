import debug from 'debug';

// Function to enable debug programmatically
export function enableDebug(pattern: string = 'e18e:*') {
  debug.enable(pattern);
}

// Create debug instances for different parts of the application
const cliDebug = debug('e18e:cli');
const fileSystemDebug = debug('e18e:cli:filesystem');

// Export the debug instances for use in different modules
export const logger = {
  debug: cliDebug,
  info: cliDebug,
  warn: cliDebug,
  error: cliDebug
};

export const fileSystemLogger = {
  debug: fileSystemDebug,
  info: fileSystemDebug,
  warn: fileSystemDebug,
  error: fileSystemDebug
};

 