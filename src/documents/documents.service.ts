import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity, DocumentStatus } from './document.entity';
import { DocumentFieldEntity } from './document-field.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { deleteStoredFile, persistFile } from './file-storage';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly repo: Repository<DocumentEntity>,
    @InjectRepository(DocumentFieldEntity) private readonly fieldRepo: Repository<DocumentFieldEntity>,
  ) {}

  async create(dto: CreateDocumentDto, file?: Express.Multer.File) {
    let stored: Awaited<ReturnType<typeof persistFile>> | undefined;
    try {
      if (file) stored = await persistFile(file);
      const doc = this.repo.create({ ...dto,
        status: dto.status ?? DocumentStatus.RECEIVED,
        fileName: stored?.name ?? null,
        storageKey: stored?.key ?? null,
        mimeType: stored?.mime ?? null,
        fileSize: stored?.size ?? null,
      });
      const saved = await this.repo.save(doc);
      saved.fileUrl = stored ? `/api/documents/${saved.id}/file` : null;
      return await this.repo.save(saved);
    } catch (error) {
      if (stored) await deleteStoredFile(stored.key);
      throw error;
    } finally {
      if (file) await deleteStoredFileTemp(file.path);
    }
  }

  async list(query: QueryDocumentsDto) {
    const { page = 1, limit = 20, search, status, fieldId } = query;
    const qb = this.repo.createQueryBuilder('d');
    if (search) qb.andWhere('(d.title ILIKE :q OR d.documentNo ILIKE :q OR d.issuingAgency ILIKE :q)', { q: `%${search}%` });
    if (status) qb.andWhere('d.status = :status', { status });
    if (fieldId) qb.andWhere('d.fieldId = :fieldId', { fieldId });
    const [items, total] = await qb.orderBy('d.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listFields() {
    return this.fieldRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async statisticsByField() {
    const rows = await this.fieldRepo
      .createQueryBuilder('field')
      .leftJoin(DocumentEntity, 'document', 'document.field_id = field.id')
      .select('field.id', 'fieldId')
      .addSelect('field.code', 'code')
      .addSelect('field.name', 'name')
      .addSelect('COUNT(document.id)', 'documentCount')
      .groupBy('field.id')
      .addGroupBy('field.code')
      .addGroupBy('field.name')
      .orderBy('field.sort_order', 'ASC')
      .addOrderBy('field.name', 'ASC')
      .getRawMany<{ fieldId: string; code: string; name: string; documentCount: string }>();

    return rows.map((row) => ({
      fieldId: row.fieldId,
      code: row.code,
      name: row.name,
      documentCount: Number(row.documentCount),
    }));
  }

  async get(id: string) {
    const doc = await this.repo.findOneBy({ id });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(id: string, dto: UpdateDocumentDto) {
    const doc = await this.get(id);
    Object.assign(doc, dto);
    return this.repo.save(doc);
  }

  async replaceFile(id: string, file: Express.Multer.File) {
    let stored: Awaited<ReturnType<typeof persistFile>> | undefined;
    try {
      const doc = await this.get(id);
      stored = await persistFile(file);
      const oldKey = doc.storageKey;
      Object.assign(doc, { storageKey: stored.key, fileName: stored.name, mimeType: stored.mime,
        fileSize: stored.size, fileUrl: `/api/documents/${id}/file` });
      const saved = await this.repo.save(doc);
      // File cleanup is best effort; a scheduled orphan cleanup is recommended.
      await deleteStoredFile(oldKey).catch(() => undefined);
      return saved;
    } catch (error) {
      if (stored) await deleteStoredFile(stored.key);
      throw error;
    } finally {
      await deleteStoredFileTemp(file.path);
    }
  }

  async delete(id: string) {
    const doc = await this.get(id);
    await this.repo.remove(doc);
    await deleteStoredFile(doc.storageKey).catch(() => undefined);
    return { deleted: true, id };
  }
}

import { unlink } from 'node:fs/promises';
async function deleteStoredFileTemp(path: string) {
  await unlink(path).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
  });
}
