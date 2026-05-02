import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripVersion } from './utils.js';

describe('--help command', () => {
  it('prints the up to date help command', () => {
    const cliPath = join(__dirname, '..', 'cli.js');

    const output = execSync(`node ${cliPath} --help`, {
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    expect(stripVersion(output.toString())).toMatchSnapshot();
  });

  it('prints the analyze command help', () => {
    const cliPath = join(__dirname, '..', 'cli.js');

    const output = execSync(`node ${cliPath} analyze --help`, {
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    const cleanOutput = stripVersion(output.toString());
    expect(cleanOutput).toMatchSnapshot();
  });

  it('prints the migrate command help', () => {
    const cliPath = join(__dirname, '..', 'cli.js');

    const output = execSync(`node ${cliPath} migrate --help`, {
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    const cleanOutput = stripVersion(output.toString());
    expect(cleanOutput).toMatchSnapshot();
  });

  it('prints the up to date version', () => {
    const cliPath = join(__dirname, '..', 'cli.js');

    const output = execSync(`node ${cliPath} --version`, {
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    expect(output.toString().trim()).toMatch(/^\d+\.\d+\.\d+(?:-\S+)?$/); /** major.minor.patch[-prerelease] */
  });
});
