import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtModule } from '@nestjs/jwt';

import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { Organization } from '../organizations/entities/organization.entity';

import { AuthSession } from './entities/auth-session.entity';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Department,
      Organization,
      AuthSession,
    ]),

    JwtModule.register({}),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
  ],
})
export class AuthModule {}