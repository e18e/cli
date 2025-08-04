import debug from 'debug';

// Create debug instances for different parts of the application
const cliDebug = debug('e18e:cli');
const fileSystemDebug = debug('e18e:filesystem');

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

// Enable debug output based on DEBUG environment variable
// This allows users to enable debug logging by setting DEBUG=e18e:*
if (process.env.DEBUG) {
  debug.enable(process.env.DEBUG);
} 