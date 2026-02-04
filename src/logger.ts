import {createDebug, enable} from 'obug';

// Function to enable debug programmatically
export function enableDebug(pattern: string = 'e18e:*') {
  enable(pattern);
}

// Create debug instances for different parts of the application
const cliDebug = createDebug('e18e:cli');
const fileSystemDebug = cliDebug.extend('filesystem');

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
