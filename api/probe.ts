/* Temporary deployment diagnostic: load the app lazily so import-time and
   boot-time failures can be reported without crashing the function. */
export default async function handler(_req: any, res: any) {
  const out: Record<string, unknown> = { node: process.version };
  try {
    const mod = await import('../server/app');
    out.appImport = 'ok';
    const app = await mod.createApp();
    out.createApp = 'ok';
    out.appType = typeof app;
  } catch (e: any) {
    out.error = String(e?.message || e);
    out.stack = String(e?.stack || '').slice(0, 1800);
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(out));
}
