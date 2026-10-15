import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './document.entity';
import { DocumentFieldEntity } from './document-field.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentFieldsController } from './document-fields.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, DocumentFieldEntity])],
  controllers: [DocumentsController, DocumentFieldsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
