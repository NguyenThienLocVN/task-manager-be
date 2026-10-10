import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { DepartmentsService } from './departments.service';

import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(
    private readonly departmentsService:
      DepartmentsService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(
      dto,
    );
  }

  @Get()
  findAll(
    @Query('organizationId')
    organizationId: string,
  ) {
    return this.departmentsService.findByOrganization(
      organizationId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.departmentsService.findOne(
      id,
    );
  }

  @Put(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(
      id,
      dto,
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id')
    id: string,

    @Body()
    body: {
      isActive: boolean;
    },
  ) {
    return this.departmentsService.updateStatus(
      id,
      body.isActive,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.departmentsService.remove(
      id,
    );
  }
}