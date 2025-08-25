import { parse } from 'shell-quote';

/**
 * Parses a command string or array into an array of arguments.
 * 
 * For string commands, properly handles:
 * - Quoted arguments with spaces: 'echo "hello world"' → ['echo', 'hello world']
 * - Single and double quotes
 * - Escaped quotes: 'echo "it\'s working"'
 * - Environment variable substitution
 * 
 * For array commands, returns the array as-is.
 * 
 * @param command - Command as string or array of arguments
 * @returns Array of command arguments with shell operators filtered out
 * 
 * @example
 * ```typescript
 * parseCommand('echo "hello world"') // ['echo', 'hello world']
 * parseCommand(['echo', 'hello world']) // ['echo', 'hello world']
 * parseCommand('node script.js --name="John Doe"') // ['node', 'script.js', '--name=John Doe']
 * ```
 */
export function parseCommand(command: string | string[]): string[] {
  if (Array.isArray(command)) {
    return command;
  }
  
  // Parse the command string properly handling quotes, escapes, etc.
  const parsed = parse(command);
  
  // Filter out shell operators (they return as objects with 'op' property)
  // and comments (they return as objects with 'comment' property)
  // Keep only string arguments
  return parsed.filter(item => typeof item === 'string') as string[];
}