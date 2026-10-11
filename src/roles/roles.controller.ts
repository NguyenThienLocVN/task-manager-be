import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { RolesService } from './roles.service';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';

@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService:
      RolesService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateRoleDto,
  ) {
    return this.rolesService.create(dto);
  }

  @Get()
  findAll(
    @Query()
    query: QueryRoleDto,
  ) {
    return this.rolesService.findAll(query);
  }

  @Get('code/:code')
  findByCode(
    @Param('code')
    code: string,
  ) {
    return this.rolesService.findByCode(
      code,
    );
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(
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
    return this.rolesService.updateStatus(
      id,
      body.isActive,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.rolesService.remove(id);
  }
}