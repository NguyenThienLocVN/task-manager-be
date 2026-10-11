import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrganizationsModule } from './organizations/organizations.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module.js';
import { RolePermissionsModule } from './role-permissions/role-permissions.module.js';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: '',
      password: '',
      database: '',
      autoLoadEntities: true,
      synchronize: false, // Set to true only in development, false in production
    }),

    OrganizationsModule,
    DepartmentsModule,
    RolesModule,
    PermissionsModule,
    RolePermissionsModule,
    UsersModule,
  ],
})
export class AppModule {}