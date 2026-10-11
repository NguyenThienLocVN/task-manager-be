import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService:
      UsersService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateUserDto,
  ) {
    return this.usersService.create(
      dto,
    );
  }

  @Get()
  findAll(
    @Query()
    query: QueryUserDto,
  ) {
    return this.usersService.findAll(
      query,
    );
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.usersService.findOne(
      id,
    );
  }

  @Put(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateUserDto,
  ) {
    return this.usersService.update(
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
    return this.usersService.updateActiveStatus(
      id,
      body.isActive,
    );
  }

  @Patch(':id/lock')
  updateLock(
    @Param('id')
    id: string,

    @Body()
    body: {
      isLocked: boolean;
    },
  ) {
    return this.usersService.updateLockStatus(
      id,
      body.isLocked,
    );
  }

  @Patch(':id/password')
  resetPassword(
    @Param('id')
    id: string,

    @Body()
    dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(
      id,
      dto,
    );
  }

  @Get(':id/roles')
  getRoles(
    @Param('id')
    id: string,
  ) {
    return this.usersService.getRoles(
      id,
    );
  }

  @Put(':id/roles')
  updateRoles(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateUserRolesDto,
  ) {
    return this.usersService.updateRoles(
      id,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.usersService.remove(
      id,
    );
  }
}