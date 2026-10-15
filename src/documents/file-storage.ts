import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { open, rename, stat, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';

export const STORAGE_DIR = join(process.cwd(), 'uploads', 'documents');
export const TEMP_DIR = join(STORAGE_DIR, '_tmp');
mkdirSync(TEMP_DIR, { recursive: true });

export const multerOptions = {
  storage: diskStorage({
    destination: TEMP_DIR,
    filename: (_req, _file, cb) => cb(null, randomUUID() + '.tmp'),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
};

const signatures: Record<string, { mime: string; matches: (b: Buffer) => boolean }> = {
  '.pdf': { mime: 'application/pdf', matches: b => b.subarray(0, 5).toString() === '%PDF-' },
  '.png': { mime: 'image/png', matches: b => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  '.jpg': { mime: 'image/jpeg', matches: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  '.jpeg': { mime: 'image/jpeg', matches: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
};

export async function persistFile(file: Express.Multer.File) {
  const ext = extname(file.originalname).toLowerCase();
  const signature = signatures[ext];
  if (!signature) throw new BadRequestException('Only PDF, PNG and JPG are supported');
  const handle = await open(file.path, 'r');
  const header = Buffer.alloc(16);
  try { await handle.read(header, 0, 16, 0); } finally { await handle.close(); }
  if (!signature.matches(header)) throw new BadRequestException('Invalid file signature');
  const key = randomUUID() + ext;
  await rename(file.path, join(STORAGE_DIR, key));
  return { key, name: file.originalname, mime: signature.mime, size: String(file.size) };
}

export async function deleteStoredFile(key?: string | null) {
  if (key) await unlink(join(STORAGE_DIR, key)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
  });
}

export async function openStoredFile(key: string) {
  const path = join(STORAGE_DIR, key);
  const info = await stat(path);
  return { stream: createReadStream(path), length: info.size };
}
