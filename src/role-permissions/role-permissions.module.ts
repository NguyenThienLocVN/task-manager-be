import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RolePermission } from './entities/role-permission.entity';

import { Role } from '../roles/entities/role.entity';

import { Permission } from '../permissions/entities/permission.entity';

import { RolePermissionsController } from './role-permissions.controller';

import { RolePermissionsService } from './role-permissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RolePermission,
      Role,
      Permission,
    ]),
  ],

  controllers: [
    RolePermissionsController,
  ],

  providers: [
    RolePermissionsService,
  ],

  exports: [
    RolePermissionsService,
  ],
})
export class RolePermissionsModule {}