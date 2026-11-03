/* Minimal dependency-free function used to verify Vercel function routing. */
export default async function handler(_req: any, res: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, node: process.version, driver: process.env.DATA_DRIVER ?? null }));
}
