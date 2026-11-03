import { Worker } from 'node:worker_threads';
import type { TestCase } from '../shared/exams';

export interface TestOutcome { name: string; passed: boolean; actual?: unknown; expected?: unknown; error?: string }
export interface RunResult { results: TestOutcome[]; logs: string[]; error?: string }

/* Student code is NEVER evaluated in the Express request context. It runs in a
   separate worker thread inside a fresh vm context with no require, process,
   fs, network or environment access, plus two independent timeouts (a vm
   execution timeout and a parent-side terminate). This is isolation from the
   application and database; see IMPLEMENTATION_STATUS.md for the honest
   statement about what a hardened production judge would additionally need. */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');

function canonical(value) {
  if (value === undefined) return '__undefined__';
  if (value === null || typeof value !== 'object') return String(typeof value === 'number' && Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
function fmt(v) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }

(async () => {
  const logs = [];
  const results = [];
  try {
    const context = {
      console: { log: (...a) => logs.push(a.map(fmt).join(' ')), error: (...a) => logs.push(a.map(fmt).join(' ')) },
      Math, JSON, Number, String, Boolean, Array, Object, RegExp, Error, Promise,
      parseInt, parseFloat, isNaN, isFinite, Intl,
      fetch: async (url) => ({ ok: true, status: 200, json: async () => ({ url, items: [] }) }),
      setTimeout: undefined, setInterval: undefined, require: undefined,
      process: undefined, Buffer: undefined,
    };
    const sandbox = vm.createContext(context, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(workerData.code, sandbox, { timeout: 1200, filename: 'student-code.js' });
    for (const test of workerData.tests) {
      try {
        const fn = sandbox[test.functionName];
        if (typeof fn !== 'function') throw new Error('Function ' + test.functionName + ' was not defined');
        let actual = fn(...(test.args || []));
        if (actual && typeof actual.then === 'function') actual = await Promise.race([
          actual, new Promise((_, reject) => setTimeout(() => reject(new Error('async test timed out')), 1200))
        ]);
        const passed = canonical(actual) === canonical(test.expected);
        results.push({ name: test.name, passed, actual: fmt(actual), expected: fmt(test.expected) });
      } catch (err) {
        results.push({ name: test.name, passed: false, error: String(err && err.message || err) });
      }
    }
    parentPort.postMessage({ results, logs });
  } catch (err) {
    parentPort.postMessage({ results, logs, error: String(err && err.message || err) });
  }
})();
`;

export function runJavaScript(code: string, tests: TestCase[], timeoutMs = 3000): Promise<RunResult> {
  return new Promise(resolve => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { code: String(code).slice(0, 20000), tests },
      resourceLimits: { maxOldGenerationSizeMb: 48, maxYoungGenerationSizeMb: 16 },
    });
    let settled = false;
    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      resolve(result);
    };
    const timer = setTimeout(() => finish({ results: [], logs: [], error: 'Execution timed out.' }), timeoutMs);
    worker.on('message', (msg: RunResult) => finish(msg));
    worker.on('error', err => finish({ results: [], logs: [], error: err.message }));
    worker.on('exit', code => {
      if (!settled) finish({ results: [], logs: [], error: `Runner exited early (${code}).` });
    });
  });
}
