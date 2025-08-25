#!/usr/bin/env node

// Test script to verify quoted arguments are passed correctly
const args = process.argv.slice(2);
console.log('Received arguments:');
args.forEach((arg, index) => {
    console.log(`  [${index}]: "${arg}"`);
});
console.log(`Total arguments: ${args.length}`);