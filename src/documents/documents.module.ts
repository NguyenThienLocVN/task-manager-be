import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentEntity } from './document.entity';
import { DocumentFieldEntity } from './document-field.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentFieldsController } from './document-fields.controller';
import { TasksModule } from '../tasks/tasks.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, DocumentFieldEntity]),
    JwtModule.register({}),
    TasksModule,
  ],
  controllers: [DocumentsController, DocumentFieldsController],
  providers: [DocumentsService, JwtAuthGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
