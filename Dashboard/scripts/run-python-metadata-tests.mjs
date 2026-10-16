#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboardDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryPython = resolve(dashboardDirectory, '..', '.venv', 'bin', 'python3');
let pythonBin = process.env.PYTHON_BIN?.trim();

if (!pythonBin) {
  try {
    await access(repositoryPython);
    pythonBin = repositoryPython;
  } catch {
    pythonBin = 'python3';
  }
}

const child = spawn(
  pythonBin,
  ['-m', 'unittest', 'discover', '-s', 'scripts/tests', '-p', 'test_*.py'],
  {
    cwd: dashboardDirectory,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    stdio: 'inherit',
  },
);

child.on('error', () => {
  console.error('Could not start Python metadata-helper tests.');
  process.exitCode = 1;
});
child.on('close', (code) => { process.exitCode = code ?? 1; });
