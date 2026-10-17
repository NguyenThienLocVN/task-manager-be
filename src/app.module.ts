import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrganizationsModule } from './organizations/organizations.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module.js';
import { RolePermissionsModule } from './role-permissions/role-permissions.module.js';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { DocumentsModule } from './documents/documents.module';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'task_admin',
      password: 'trinhthu2026!',
      database: 'task_management',
      autoLoadEntities: true,
      synchronize: false, // Set to true only in development, false in production
    }),

    OrganizationsModule,
    DepartmentsModule,
    RolesModule,
    PermissionsModule,
    RolePermissionsModule,
    UsersModule,
    AuthModule,
    DocumentsModule,
    TasksModule,
  ],
})
export class AppModule {}