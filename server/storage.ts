import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/** Writes to Supabase Storage in production mode, or the local storage
 *  directory in the self-contained runtime. Returns a browser-usable URL. */
export async function putFile(bucket: 'subtitles' | 'lesson-assets', name: string, content: string | Buffer, contentType: string): Promise<string> {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (env.driver === 'supabase') {
    const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });
    const { error } = await client.storage.from(bucket).upload(safe, content, { contentType, upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    if (bucket === 'lesson-assets') {
      const { data } = client.storage.from(bucket).getPublicUrl(safe);
      return data.publicUrl;
    }
    const { data: signed, error: signErr } = await client.storage.from(bucket).createSignedUrl(safe, 60 * 60 * 24 * 30);
    if (signErr) throw new Error(`Signed URL failed: ${signErr.message}`);
    return signed.signedUrl;
  }
  const dir = path.join(env.storageDir, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safe), content);
  return `/files/${bucket}/${safe}`;
}

export async function readLocalFile(relative: string): Promise<Buffer | null> {
  const file = path.join(env.storageDir, relative);
  try { return await fs.readFile(file); } catch { return null; }
}
