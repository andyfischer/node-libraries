import { describe, it, expect } from 'vitest';
import { parseCommand } from '../utils/parseCommand';

describe('parseCommand', () => {
    describe('array commands', () => {
        it('should return array commands as-is', () => {
            const command = ['echo', 'hello', 'world'];
            const result = parseCommand(command);
            
            expect(result).toEqual(command);
            expect(result).toBe(command); // Should be the same reference
        });

        it('should handle empty arrays', () => {
            const command: string[] = [];
            const result = parseCommand(command);
            
            expect(result).toEqual([]);
        });

        it('should handle arrays with complex arguments', () => {
            const command = ['node', 'script.js', '--name=John Doe', '--verbose'];
            const result = parseCommand(command);
            
            expect(result).toEqual(command);
        });
    });

    describe('string commands - basic cases', () => {
        it('should parse simple commands', () => {
            const result = parseCommand('echo hello world');
            expect(result).toEqual(['echo', 'hello', 'world']);
        });

        it('should handle single word commands', () => {
            const result = parseCommand('ls');
            expect(result).toEqual(['ls']);
        });

        it('should handle empty strings', () => {
            const result = parseCommand('');
            expect(result).toEqual([]);
        });

        it('should handle commands with multiple spaces', () => {
            const result = parseCommand('echo   hello    world');
            expect(result).toEqual(['echo', 'hello', 'world']);
        });
    });

    describe('string commands - quoted arguments', () => {
        it('should handle double-quoted arguments with spaces', () => {
            const result = parseCommand('echo "hello world"');
            expect(result).toEqual(['echo', 'hello world']);
        });

        it('should handle single-quoted arguments with spaces', () => {
            const result = parseCommand("echo 'hello world'");
            expect(result).toEqual(['echo', 'hello world']);
        });

        it('should handle mixed quotes', () => {
            const result = parseCommand('echo "hello world" \'foo bar\'');
            expect(result).toEqual(['echo', 'hello world', 'foo bar']);
        });

        it('should handle quotes within quotes', () => {
            const result = parseCommand('echo "it\'s working"');
            expect(result).toEqual(['echo', "it's working"]);
        });

        it('should handle escaped quotes', () => {
            const result = parseCommand('echo "say \\"hello\\""');
            expect(result).toEqual(['echo', 'say "hello"']);
        });

        it('should handle empty quoted strings', () => {
            const result = parseCommand('echo "" test');
            expect(result).toEqual(['echo', '', 'test']);
        });
    });

    describe('string commands - complex scenarios', () => {
        it('should handle command line flags with quoted values', () => {
            const result = parseCommand('node script.js --name="John Doe" --age=30');
            expect(result).toEqual(['node', 'script.js', '--name=John Doe', '--age=30']);
        });

        it('should handle paths with spaces', () => {
            const result = parseCommand('node "/path/to/my script.js"');
            expect(result).toEqual(['node', '/path/to/my script.js']);
        });

        it('should handle multiple quoted arguments', () => {
            const result = parseCommand('cp "source file.txt" "destination file.txt"');
            expect(result).toEqual(['cp', 'source file.txt', 'destination file.txt']);
        });

        it('should handle complex mixed quoting', () => {
            const result = parseCommand('echo "first arg" \'second arg\' third "fourth arg"');
            expect(result).toEqual(['echo', 'first arg', 'second arg', 'third', 'fourth arg']);
        });
    });

    describe('string commands - shell operators filtering', () => {
        it('should filter out pipe operators', () => {
            const result = parseCommand('echo hello | grep hello');
            // Shell operators are filtered out, only string arguments remain
            expect(result).toEqual(['echo', 'hello', 'grep', 'hello']);
        });

        it('should filter out redirect operators', () => {
            const result = parseCommand('echo hello > output.txt');
            expect(result).toEqual(['echo', 'hello', 'output.txt']);
        });

        it('should filter out AND/OR operators', () => {
            const result = parseCommand('echo hello && echo world');
            expect(result).toEqual(['echo', 'hello', 'echo', 'world']);
        });

        it('should filter out comments', () => {
            const result = parseCommand('echo hello # this is a comment');
            expect(result).toEqual(['echo', 'hello']);
        });
    });

    describe('string commands - edge cases', () => {
        it('should handle commands with only whitespace', () => {
            const result = parseCommand('   ');
            expect(result).toEqual([]);
        });

        it('should handle backslashes in commands', () => {
            const result = parseCommand('echo\\thello\\nworld');
            // Backslashes without spaces are treated as literal characters
            expect(result).toEqual(['echothellonworld']);
        });

        it('should handle backslash escapes', () => {
            const result = parseCommand('echo hello\\ world');
            expect(result).toEqual(['echo', 'hello world']);
        });

        it('should handle environment variables', () => {
            const result = parseCommand('echo $HOME');
            // Environment variables are expanded to empty string when no env context provided
            expect(result).toEqual(['echo', '']);
        });
    });

    describe('real-world examples', () => {
        it('should handle npm script-like commands', () => {
            const result = parseCommand('node --max-old-space-size=4096 "build script.js" --verbose');
            expect(result).toEqual(['node', '--max-old-space-size=4096', 'build script.js', '--verbose']);
        });

        it('should handle git commands with quoted commit messages', () => {
            const result = parseCommand('git commit -m "Add new feature with spaces"');
            expect(result).toEqual(['git', 'commit', '-m', 'Add new feature with spaces']);
        });

        it('should handle curl commands with quoted URLs', () => {
            const result = parseCommand('curl "https://api.example.com/data?param=value with spaces"');
            expect(result).toEqual(['curl', 'https://api.example.com/data?param=value with spaces']);
        });

        it('should handle docker commands with quoted arguments', () => {
            const result = parseCommand('docker run -e "ENV_VAR=value with spaces" ubuntu echo hello');
            expect(result).toEqual(['docker', 'run', '-e', 'ENV_VAR=value with spaces', 'ubuntu', 'echo', 'hello']);
        });
    });
});