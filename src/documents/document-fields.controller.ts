import { Controller, Get } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('document-fields')
export class DocumentFieldsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  list() {
    return this.service.listFields();
  }
}
