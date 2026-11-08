import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runValidateCommand } from '../../src/cli/validate.js';

describe('CLI Validate Command', () => {
  it('exits with 0 on a valid dataset', () => {
    const validDir = path.resolve('tests/fixtures/valid-dataset');
    const exitCode = runValidateCommand({ dataDir: validDir, silent: true });
    expect(exitCode).toBe(0);
  });

  it('exits with 1 on a cyclic parentage dataset', () => {
    const cycleDir = path.resolve('tests/fixtures/invalid-cycle');
    const exitCode = runValidateCommand({ dataDir: cycleDir, silent: true });
    expect(exitCode).toBe(1);
  });
});
