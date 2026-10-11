import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Department } from '../departments/entities/department.entity';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRole,
      Role,
      Organization,
      Department,
    ]),
  ],

  controllers: [
    UsersController,
  ],

  providers: [
    UsersService,
  ],

  exports: [
    UsersService,
  ],
})
export class UsersModule {}