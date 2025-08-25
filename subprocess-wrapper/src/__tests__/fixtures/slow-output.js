#!/usr/bin/env node

const delay = parseInt(process.argv[2]) || 100;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Line 1');
    await sleep(delay);
    console.log('Line 2');
    await sleep(delay);
    console.log('Line 3');
}

main();