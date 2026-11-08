import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import express from 'express';
import multer from 'multer';
import request from 'supertest';
import { deleteStoredFile, multerOptions, persistFile, TEMP_DIR } from './file-storage';

function archive(names: string[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(name);
    const entry = Buffer.alloc(30);
    entry.writeUInt32LE(0x04034b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(filename.length, 26);
    const directoryEntry = Buffer.alloc(46);
    directoryEntry.writeUInt32LE(0x02014b50, 0);
    directoryEntry.writeUInt16LE(20, 4);
    directoryEntry.writeUInt16LE(20, 6);
    directoryEntry.writeUInt16LE(filename.length, 28);
    directoryEntry.writeUInt32LE(offset, 42);
    local.push(entry, filename);
    central.push(directoryEntry, filename);
    offset += entry.length + filename.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

describe('persistFile Office uploads', () => {
  const tempFiles: string[] = [];
  const storedFiles: string[] = [];

  async function file(name: string, content: Buffer): Promise<Express.Multer.File> {
    const path = join(TEMP_DIR, `${randomUUID()}.tmp`);
    tempFiles.push(path);
    await writeFile(path, content);
    return {
      fieldname: 'file', originalname: name, encoding: '7bit',
      mimetype: 'application/octet-stream', size: content.length, path,
      destination: TEMP_DIR, filename: '', buffer: Buffer.alloc(0),
      stream: Readable.from(content),
    };
  }

  afterEach(async () => {
    await Promise.all(storedFiles.splice(0).map(key => deleteStoredFile(key)));
    await Promise.all(tempFiles.splice(0).map(path =>
      unlink(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      }),
    ));
  });

  describe('multipart filename decoding', () => {
    const uploadedPaths: string[] = [];
    const app = express();
    app.post('/upload', multer(multerOptions).single('file'), (req, res) => {
      if (!req.file) {
        res.status(400).send('Missing file');
        return;
      }
      uploadedPaths.push(req.file.path);
      res.json({ name: req.file.originalname });
    });

    afterEach(async () => {
      await Promise.all(uploadedPaths.splice(0).map(path => unlink(path)));
    });

    it.each([
      'Phụ lục 2. Danh sách cá nhân.xlsx',
      'report.pdf',
      'café.pdf',
    ])('decodes browser-uploaded filename %s', async name => {
      const response = await request(app)
        .post('/upload')
        .attach('file', Buffer.from('file contents'), { filename: name });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name });
    });

    it('respects an explicitly UTF-8 encoded filename parameter', async () => {
      const name = 'Phụ lục.xlsx';
      const boundary = 'upload-test-boundary';
      const body = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Content-Type: application/octet-stream',
        '',
        'file contents',
        `--${boundary}--`,
        '',
      ].join('\r\n');
      const response = await request(app)
        .post('/upload')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(body);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name });
    });
  });

  it.each([
    ['report.DOC', 'application/msword', Buffer.from('d0cf11e0a1b11ae10000000000000000', 'hex')],
    ['report.xls', 'application/vnd.ms-excel', Buffer.from('d0cf11e0a1b11ae10000000000000000', 'hex')],
    ['report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', archive(['[Content_Types].xml', 'word/document.xml'])],
    ['report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', archive(['[Content_Types].xml', 'xl/workbook.xml'])],
  ])('accepts %s with its expected MIME type', async (name, mime, content) => {
    const result = await persistFile(await file(name, content), true);
    storedFiles.push(result.key);
    expect(result).toMatchObject({ name, mime, size: String(content.length) });
  });

  it('rejects Office files where they are not enabled', async () => {
    const upload = await file('report.docx', archive(['[Content_Types].xml', 'word/document.xml']));
    await expect(persistFile(upload)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('continues to accept PDF uploads when Office files are enabled', async () => {
    const result = await persistFile(await file('report.pdf', Buffer.from('%PDF-1.7')), true);
    storedFiles.push(result.key);
    expect(result.mime).toBe('application/pdf');
  });

  it.each([
    ['report.doc', Buffer.from('not an Office file')],
    ['report.docx', Buffer.from('504b0304000000000000000000000000', 'hex')],
    ['report.docx', archive(['word/document.xml'])],
    ['report.xlsx', archive(['[Content_Types].xml', 'word/document.xml'])],
  ])('rejects invalid %s content', async (name, content) => {
    await expect(persistFile(await file(name, content), true)).rejects.toBeInstanceOf(BadRequestException);
  });
});
