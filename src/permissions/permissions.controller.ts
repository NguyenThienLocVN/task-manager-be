import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { PermissionsService } from './permissions.service';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { QueryPermissionDto } from './dto/query-permission.dto';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService:
      PermissionsService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreatePermissionDto,
  ) {
    return this.permissionsService.create(
      dto,
    );
  }

  @Get()
  findAll(
    @Query()
    query: QueryPermissionDto,
  ) {
    return this.permissionsService.findAll(
      query,
    );
  }

  @Get('code/:code')
  findByCode(
    @Param('code')
    code: string,
  ) {
    return this.permissionsService.findByCode(
      code,
    );
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.permissionsService.findOne(
      id,
    );
  }

  @Put(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(
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
    return this.permissionsService.updateStatus(
      id,
      body.isActive,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.permissionsService.remove(
      id,
    );
  }
}