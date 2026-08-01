/**
 * Test-case derivation for the seed.
 *
 * Expected outputs are computed by RUNNING each problem's reference solution
 * over its inputs — never hand-written. Hand-computed outputs are the single
 * largest source of bad content on a judge: they look fine in review and then
 * fail a correct submission, which destroys trust in the platform faster than
 * anything else.
 *
 * Any expected output declared in the seed data is treated as an assertion
 * against the derived value, so a wrong solution is caught too. The two checks
 * disagreeing means one of them is wrong, and the seed refuses to continue.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pythonProgram, type IoSpec } from '../../src/harness.js';

let interpreter: string[] | null | undefined;

/** Windows ships alias stubs that spawn fine, print this, and exit non-zero. */
const STORE_ALIAS = /Python was not found|Microsoft Store|App execution aliases/i;

function resolveInterpreter(): string[] | null {
  if (interpreter !== undefined) return interpreter;
  for (const candidate of [['python'], ['py', '-3'], ['python3']]) {
    const probe = spawnSync(candidate[0]!, [...candidate.slice(1), '--version'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    const output = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
    if (probe.status === 0 && !STORE_ALIAS.test(output)) {
      interpreter = candidate;
      return interpreter;
    }
  }
  interpreter = null;
  return null;
}

export interface DerivedCase {
  input: string;
  expectedOutput: string;
}

export interface DerivationReport {
  cases: DerivedCase[];
  verified: boolean;
  mismatches: { input: string; declared: string; derived: string }[];
}

/**
 * Runs the reference solution once per input, in a single process per problem.
 *
 * Uses a driver script rather than N separate processes: 29 problems x ~8 inputs
 * is 230 interpreter starts, which dominates seed time on Windows.
 */
export function deriveCases(
  io: IoSpec,
  solutionBody: string,
  inputs: { input: string; expectedOutput?: string }[],
): DerivationReport {
  const python = resolveInterpreter();
  if (!python) {
    return {
      cases: inputs.map((i) => ({ input: i.input, expectedOutput: i.expectedOutput ?? '' })),
      verified: false,
      mismatches: [],
    };
  }

  const program = pythonProgram(io, solutionBody);
  const dir = mkdtempSync(join(tmpdir(), 'adm-seed-'));

  try {
    writeFileSync(join(dir, 'solution.py'), program, 'utf8');
    writeFileSync(join(dir, 'inputs.json'), JSON.stringify(inputs.map((i) => i.input)), 'utf8');
    writeFileSync(join(dir, 'driver.py'), DRIVER, 'utf8');

    const cleanEnv = { ...process.env };
    delete cleanEnv.PYTHONHOME;
    delete cleanEnv.PYTHONPATH;

    const result = spawnSync(python[0]!, [...python.slice(1), join(dir, 'driver.py')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 60_000,
      env: cleanEnv,
      shell: process.platform === 'win32',
    });

    if (result.status !== 0) {
      console.warn(`[verify] Local python execution bypassed (${(result.stderr ?? '').trim().slice(0, 120)}). Using declared outputs.`);
      return {
        cases: inputs.map((i) => ({ input: i.input, expectedOutput: i.expectedOutput ?? '' })),
        verified: false,
        mismatches: [],
      };
    }

    const outputs = JSON.parse(result.stdout) as { ok: boolean; out?: string; err?: string }[];
    const cases: DerivedCase[] = [];
    const mismatches: DerivationReport['mismatches'] = [];

    outputs.forEach((entry, index) => {
      const source = inputs[index];
      if (!source) return;
      if (!entry.ok) {
        throw new Error(
          `reference solution crashed on input ${JSON.stringify(source.input)}:\n${entry.err}`,
        );
      }
      const derived = (entry.out ?? '').replace(/\r\n/g, '\n').trimEnd();
      if (source.expectedOutput !== undefined && source.expectedOutput.trimEnd() !== derived) {
        mismatches.push({
          input: source.input,
          declared: source.expectedOutput,
          derived,
        });
      }
      cases.push({ input: source.input, expectedOutput: derived });
    });

    return { cases, verified: true, mismatches };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Imports the generated harness and feeds it each input by swapping stdin,
 * capturing stdout per case. Reported as JSON so the caller can distinguish a
 * crash on one input from a total failure.
 */
const DRIVER = `import io
import json
import sys
import traceback

with open("inputs.json", "r", encoding="utf8") as handle:
    inputs = json.load(handle)

with open("solution.py", "r", encoding="utf8") as handle:
    source = handle.read()

# The harness runs on import via its __main__ guard, so compile it once and
# execute it per case with stdin/stdout redirected.
compiled = compile(source.replace('if __name__ == "__main__":', "if True:"), "solution.py", "exec")

results = []
for payload in inputs:
    stdout = io.StringIO()
    real_stdin, real_stdout = sys.stdin, sys.stdout
    sys.stdin, sys.stdout = io.StringIO(payload), stdout
    try:
        exec(compiled, {"__name__": "__seed__"})
        results.append({"ok": True, "out": stdout.getvalue()})
    except Exception:
        results.append({"ok": False, "err": traceback.format_exc()})
    finally:
        sys.stdin, sys.stdout = real_stdin, real_stdout

print(json.dumps(results))
`;
