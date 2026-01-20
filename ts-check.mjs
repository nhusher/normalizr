#!/usr/bin/env node
/**
 * TypeScript Language Service Diagnostic Checker
 *
 * This tool queries the TypeScript language service directly (the same service
 * that powers IDE features) rather than the CLI compiler. This can reveal
 * type errors that `tsc` doesn't catch, or vice versa.
 *
 * Usage:
 *   node ts-check.mjs <file> [line numbers...]
 *
 * Examples:
 *   # Check all diagnostics in a file
 *   node ts-check.mjs src/index.ts
 *
 *   # Check specific lines only
 *   node ts-check.mjs src/index.ts 42 57 103
 *
 *   # With npx (if typescript isn't installed locally)
 *   npx ts-node ts-check.mjs src/index.ts
 *
 * Requirements:
 *   - Run from a directory with node_modules/typescript installed
 *   - A tsconfig.json must exist in the current directory or a parent
 *
 * Output format:
 *   file.ts:line:column: error message
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
TypeScript Language Service Diagnostic Checker

Usage: node ts-check.mjs <file> [line numbers...]

Examples:
  node ts-check.mjs src/index.ts           # All diagnostics
  node ts-check.mjs src/index.ts 42 57     # Lines 42 and 57 only

Options:
  --help, -h     Show this help message
  --verbose, -v  Show additional debug information
  --all          Show all diagnostics in project (ignore file argument)
`);
  process.exit(0);
}

const verbose = args.includes('--verbose') || args.includes('-v');
const showAll = args.includes('--all');
const filteredArgs = args.filter(a => !a.startsWith('-'));

const targetFile = resolve(filteredArgs[0]);
const lineNumbers = filteredArgs.slice(1).map(Number).filter(n => !isNaN(n));

// Find TypeScript installation
function findTypeScript(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const tsPath = resolve(dir, 'node_modules/typescript/lib/typescript.js');
    if (existsSync(tsPath)) {
      return tsPath;
    }
    dir = dirname(dir);
  }
  return null;
}

const tsPath = findTypeScript(process.cwd()) || findTypeScript(dirname(targetFile));
if (!tsPath) {
  console.error('Error: Could not find TypeScript installation.');
  console.error('Make sure you run this from a directory with node_modules/typescript installed.');
  process.exit(1);
}

if (verbose) {
  console.log(`Using TypeScript from: ${tsPath}`);
}

// Dynamic import of TypeScript
const ts = (await import(tsPath)).default;

if (verbose) {
  console.log(`TypeScript version: ${ts.version}`);
}

// Find and parse tsconfig
const configPath = ts.findConfigFile(
  dirname(targetFile),
  ts.sys.fileExists,
  'tsconfig.json'
);

if (!configPath) {
  console.error('Error: Could not find tsconfig.json');
  console.error(`Searched from: ${dirname(targetFile)}`);
  process.exit(1);
}

if (verbose) {
  console.log(`Using tsconfig: ${configPath}`);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error('Error reading tsconfig.json:');
  console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  process.exit(1);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  dirname(configPath)
);

if (parsedConfig.errors.length > 0) {
  console.error('Errors parsing tsconfig.json:');
  parsedConfig.errors.forEach(e => {
    console.error(ts.flattenDiagnosticMessageText(e.messageText, '\n'));
  });
  process.exit(1);
}

// Add target file if not in the project
let fileNames = parsedConfig.fileNames;
if (!showAll && !fileNames.includes(targetFile)) {
  fileNames = [...fileNames, targetFile];
  if (verbose) {
    console.log(`Added ${targetFile} to file list (not in tsconfig include)`);
  }
}

// Create language service host
const fileVersions = new Map();
const servicesHost = {
  getScriptFileNames: () => fileNames,
  getScriptVersion: (fileName) => {
    if (!fileVersions.has(fileName)) {
      fileVersions.set(fileName, '1');
    }
    return fileVersions.get(fileName);
  },
  getScriptSnapshot: (fileName) => {
    if (!ts.sys.fileExists(fileName)) {
      return undefined;
    }
    return ts.ScriptSnapshot.fromString(readFileSync(fileName, 'utf8'));
  },
  getCurrentDirectory: () => dirname(configPath),
  getCompilationSettings: () => ({
    ...parsedConfig.options,
    // Allow files outside rootDir for checking arbitrary files
    rootDir: undefined,
  }),
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};

// Create the language service
const services = ts.createLanguageService(
  servicesHost,
  ts.createDocumentRegistry()
);

if (verbose) {
  console.log(`Language service created with ${fileNames.length} files`);
  console.log('');
}

// Collect diagnostics
let allDiagnostics = [];

if (showAll) {
  // Get diagnostics for all files in the project
  for (const file of fileNames) {
    try {
      const semantic = services.getSemanticDiagnostics(file);
      const syntactic = services.getSyntacticDiagnostics(file);
      allDiagnostics.push(...syntactic, ...semantic);
    } catch (e) {
      if (verbose) {
        console.error(`Error checking ${file}: ${e.message}`);
      }
    }
  }
} else {
  // Get diagnostics for target file only
  try {
    const semanticDiagnostics = services.getSemanticDiagnostics(targetFile);
    const syntacticDiagnostics = services.getSyntacticDiagnostics(targetFile);
    allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics];
  } catch (e) {
    console.error(`Error getting diagnostics: ${e.message}`);
    if (verbose) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}

// Filter by line numbers if specified
if (lineNumbers.length > 0) {
  allDiagnostics = allDiagnostics.filter(d => {
    if (!d.file || d.start === undefined) return false;
    const pos = d.file.getLineAndCharacterOfPosition(d.start);
    return lineNumbers.includes(pos.line + 1);
  });
}

// Format and output diagnostics
function formatDiagnostic(d) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');

  if (d.file && d.start !== undefined) {
    const pos = d.file.getLineAndCharacterOfPosition(d.start);
    const line = pos.line + 1;
    const char = pos.character + 1;
    const fileName = d.file.fileName;

    // Color output if terminal supports it
    const isError = d.category === ts.DiagnosticCategory.Error;
    const prefix = isError ? '\x1b[31merror\x1b[0m' : '\x1b[33mwarning\x1b[0m';

    return `${fileName}:${line}:${char}: ${prefix} TS${d.code}: ${msg}`;
  }

  return msg;
}

if (allDiagnostics.length === 0) {
  if (lineNumbers.length > 0) {
    console.log(`No diagnostics found on lines: ${lineNumbers.join(', ')}`);
  } else {
    console.log('No diagnostics found');
  }
  process.exit(0);
}

// Sort by file, then line number
allDiagnostics.sort((a, b) => {
  const fileA = a.file?.fileName || '';
  const fileB = b.file?.fileName || '';
  if (fileA !== fileB) return fileA.localeCompare(fileB);

  const lineA = a.file && a.start !== undefined
    ? a.file.getLineAndCharacterOfPosition(a.start).line
    : 0;
  const lineB = b.file && b.start !== undefined
    ? b.file.getLineAndCharacterOfPosition(b.start).line
    : 0;
  return lineA - lineB;
});

// Output
allDiagnostics.forEach(d => {
  console.log(formatDiagnostic(d));
});

// Summary
const errorCount = allDiagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length;
const warningCount = allDiagnostics.filter(d => d.category === ts.DiagnosticCategory.Warning).length;

console.log('');
console.log(`Found ${errorCount} error(s), ${warningCount} warning(s)`);

process.exit(errorCount > 0 ? 1 : 0);
