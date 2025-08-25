#!/usr/bin/env node

const exitCode = parseInt(process.argv[2]) || 0;
console.log(`Exiting with code: ${exitCode}`);
process.exit(exitCode);