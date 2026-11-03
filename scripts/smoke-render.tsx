/* Headless render smoke test. Mounts the real React app in Happy DOM against
   a running dev server and checks that a signed-in user sees real data.
   Run: npm run dev:once, then:
     npx tsx scripts/smoke-render.tsx
     SMOKE_ACCOUNT=ACECODES SMOKE_PASSWORD=ace-teaches SMOKE_START=/ace \
       SMOKE_EXPECT='Daniella.s progress,ACECODES,Areas where she struggles' \
       npx tsx scripts/smoke-render.tsx
*/
import { Window } from 'happy-dom';
import React from 'react';
import { createRoot } from 'react-dom/client';

const BASE = process.env.SMOKE_BASE || 'http://localhost:5173';
const START = process.env.SMOKE_START || '/app';
const win = new Window({ url: BASE + START });
const g = globalThis as any;
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'PopStateEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage', 'DOMParser', 'Blob', 'FileReader', 'URL']) {
  if ((win as any)[key] === undefined) continue;
  Object.defineProperty(g, key, { value: (win as any)[key], configurable: true, writable: true });
}
g.IS_REACT_ACT_ENVIRONMENT = false;
if (!g.IntersectionObserver) g.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as any;
if (!g.ResizeObserver) g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
if (!win.matchMedia) (win as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.matchMedia = (win as any).matchMedia;

const reactErrors: string[] = [];
const originalError = console.error;
console.error = (...args: any[]) => { const text = args.map(String).join(' '); if (/error occurred in the|ReferenceError|TypeError/.test(text)) reactErrors.push(text); originalError(...args); };

const realFetch = globalThis.fetch;
const login = await realFetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accountId: process.env.SMOKE_ACCOUNT || 'DANIELLACODES', password: process.env.SMOKE_PASSWORD || 'daniella-learns' }),
});
if (!login.ok) throw new Error('Login failed: ' + (await login.text()));
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
g.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string' ? new URL(input, BASE).toString() : input;
  return realFetch(url, { ...init, headers: { ...(init.headers || {}), Cookie: cookie } });
};

const { default: App } = await import('../src/App');
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
root.render(React.createElement(App));
await new Promise(r => setTimeout(r, 2200));

const defaults = ['Hey, Daniella!', 'Overall learning progress', 'Introduction to Programming', 'Created by Divine'];
const expected = (process.env.SMOKE_EXPECT ? process.env.SMOKE_EXPECT.split(',') : defaults).map(s => new RegExp(s));
const html = document.body.innerHTML;
let failed = 0;
for (const re of expected) {
  const ok = re.test(html);
  console.log(`${ok ? 'PASS' : 'FAIL'}  renders ${re}`);
  if (!ok) failed++;
}
if (reactErrors.length) { console.log(`FAIL  ${reactErrors.length} React runtime errors`); failed++; }
if (failed) {
  console.log('\n--- first 1600 chars of rendered DOM ---\n', html.slice(0, 1600));
  console.log('\n--- errors ---\n', reactErrors.slice(0, 2).join('\n'));
  process.exit(1);
}
console.log('\nSmoke render OK.');
root.unmount();
await win.happyDOM.close();
process.exit(0);
