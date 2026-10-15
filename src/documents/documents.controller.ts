import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
  Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { multerOptions, openStoredFile } from './file-storage';

// IMPORTANT: add your application's authentication & document authorization guards
// at this controller before exposing the routes outside a trusted environment.
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  create(@Body() dto: CreateDocumentDto, @UploadedFile() file?: Express.Multer.File) {
    return this.service.create(dto, file);
  }

  @Get()
  list(@Query() query: QueryDocumentsDto) { return this.service.list(query); }

  @Get('statistics/by-field')
  statisticsByField() { return this.service.statisticsByField(); }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  replaceFile(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');
    return this.service.replaceFile(id, file);
  }

  @Get(':id/file')
  preview(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    return this.stream(id, res, false);
  }

  @Get(':id/download')
  download(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    return this.stream(id, res, true);
  }

  private async stream(id: string, res: Response, download: boolean): Promise<StreamableFile> {
    const doc = await this.service.get(id);
    if (!doc.storageKey || !doc.mimeType) throw new BadRequestException('Document has no file');
    const { stream, length } = await openStoredFile(doc.storageKey);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    const mode = download ? 'attachment' : 'inline';
    const filename = encodeURIComponent(doc.fileName ?? 'document');
    res.setHeader('Content-Disposition', `${mode}; filename="document"; filename*=UTF-8''${filename}`);
    return new StreamableFile(stream, { type: doc.mimeType, length });
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) { return this.service.delete(id); }
}
