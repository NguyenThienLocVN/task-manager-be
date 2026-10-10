import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Department } from './entities/department.entity';
import { Organization } from '../organizations/entities/organization.entity';

import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      Organization,
    ]),
  ],

  providers: [
    DepartmentsService,
  ],

  controllers: [
    DepartmentsController,
  ],

  exports: [
    DepartmentsService,
  ],
})
export class DepartmentsModule {}