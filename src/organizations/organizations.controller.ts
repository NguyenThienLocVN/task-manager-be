import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { OrganizationsService } from './organizations.service';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService:
      OrganizationsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(dto);
  }

  @Get()
  findAll(
    @Query('keyword')
    keyword?: string,

    @Query('isActive')
    isActive?: string,
  ) {
    let activeFilter:
      | boolean
      | undefined;

    if (isActive === 'true') {
      activeFilter = true;
    }

    if (isActive === 'false') {
      activeFilter = false;
    }

    return this.organizationsService.findAll(
      keyword,
      activeFilter,
    );
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.organizationsService.findOne(
      id,
    );
  }

  @Put(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(
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
    return this.organizationsService.updateStatus(
      id,
      body.isActive,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.organizationsService.remove(id);
  }
}