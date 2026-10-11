import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

import { RolePermissionsService } from './role-permissions.service';

import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('roles')
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService:
      RolePermissionsService,
  ) {}

  @Get(':roleId/permissions')
  getByRole(
    @Param('roleId')
    roleId: string,
  ) {
    return this.rolePermissionsService.getByRole(
      roleId,
    );
  }

  @Put(':roleId/permissions')
  updatePermissions(
    @Param('roleId')
    roleId: string,

    @Body()
    dto: UpdateRolePermissionsDto,
  ) {
    return this.rolePermissionsService.updatePermissions(
      roleId,
      dto,
    );
  }

  @Post(
    ':roleId/permissions/:permissionId',
  )
  addPermission(
    @Param('roleId')
    roleId: string,

    @Param('permissionId')
    permissionId: string,
  ) {
    return this.rolePermissionsService.addPermission(
      roleId,
      permissionId,
    );
  }

  @Delete(
    ':roleId/permissions/:permissionId',
  )
  removePermission(
    @Param('roleId')
    roleId: string,

    @Param('permissionId')
    permissionId: string,
  ) {
    return this.rolePermissionsService.removePermission(
      roleId,
      permissionId,
    );
  }
}