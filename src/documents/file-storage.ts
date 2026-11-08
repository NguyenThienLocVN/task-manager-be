import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { open, rename, stat, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import { open as openZip } from 'yauzl';

export const STORAGE_DIR = join(process.cwd(), 'uploads', 'documents');
export const TEMP_DIR = join(STORAGE_DIR, '_tmp');
mkdirSync(TEMP_DIR, { recursive: true });

export const multerOptions = {
  defParamCharset: 'utf8',
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

const officeSignatures: Record<string, { mime: string; matches: (b: Buffer) => boolean; entry?: string }> = {
  '.doc': { mime: 'application/msword', matches: matchesOle },
  '.xls': { mime: 'application/vnd.ms-excel', matches: matchesOle },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', matches: matchesZip, entry: 'word/document.xml' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', matches: matchesZip, entry: 'xl/workbook.xml' },
};

function matchesOle(header: Buffer) {
  return header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
}

function matchesZip(header: Buffer) {
  return header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}

async function validateOfficeArchive(path: string, requiredEntry: string) {
  const zip = await new Promise<import('yauzl').ZipFile>((resolve, reject) => {
    openZip(path, { lazyEntries: true }, (error, file) => {
      if (error || !file) reject(error ?? new Error('Invalid ZIP archive'));
      else resolve(file);
    });
  }).catch(() => {
    throw new BadRequestException('Invalid Office file');
  });
  const entries = new Set<string>();
  let count = 0;
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('entry', entry => {
      if (++count > 10000) {
        zip.close();
        reject(new Error('Too many ZIP entries'));
        return;
      }
      entries.add(entry.fileName);
      zip.readEntry();
    });
    zip.on('end', resolve);
    zip.readEntry();
  }).catch(() => {
    throw new BadRequestException('Invalid Office file');
  }).finally(() => zip.close());
  if (!entries.has('[Content_Types].xml') || !entries.has(requiredEntry)) {
    throw new BadRequestException('Invalid Office file');
  }
}

export async function persistFile(file: Express.Multer.File, allowOffice = false) {
  const ext = extname(file.originalname).toLowerCase();
  const signature = signatures[ext] ?? (allowOffice ? officeSignatures[ext] : undefined);
  if (!signature) throw new BadRequestException(allowOffice
    ? 'Only PDF, PNG, JPG, DOC, DOCX, XLS and XLSX are supported'
    : 'Only PDF, PNG and JPG are supported');
  const handle = await open(file.path, 'r');
  const header = Buffer.alloc(16);
  try { await handle.read(header, 0, 16, 0); } finally { await handle.close(); }
  if (!signature.matches(header)) throw new BadRequestException('Invalid file signature');
  const officeSignature = allowOffice ? officeSignatures[ext] : undefined;
  if (officeSignature?.entry) await validateOfficeArchive(file.path, officeSignature.entry);
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
