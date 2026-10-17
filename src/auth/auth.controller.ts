import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';

import type { Request, Response } from 'express';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { CurrentUser } from './decorators/current-user.decorator';

import type { AuthUser } from './interfaces/auth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
  ) {}

  @Post('register')
  register(
    @Body()
    dto: RegisterDto,
  ) {
    return this.authService.register(
      dto,
    );
  }

  @Post('login')
  async login(
    @Body()
    dto: LoginDto,

    @Req()
    request: Request,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    const result =
      await this.authService.login(
        dto,
        {
          ipAddress:
            request.ip,

          userAgent:
            request.headers[
              'user-agent'
            ],
        },
      );

    response.cookie(
      'refresh_token',
      result.refreshToken,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite: 'lax',

        maxAge:
          result.refreshExpiresSeconds *
          1000,

        path: '/api/auth',
      },
    );

    return {
      accessToken:
        result.accessToken,

      user:
        result.user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req()
    request: Request,
  ) {
    const refreshToken =
      request.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Thiếu refresh token',
      );
    }

    return this.authService.refresh(
      refreshToken,
    );
  }

  @Post('logout')
  async logout(
    @Req()
    request: Request,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    await this.authService.logout(
      request.cookies?.refresh_token,
    );

    response.clearCookie(
      'refresh_token',
      {
        path: '/api/auth',
      },
    );

    return {
      message: 'Đăng xuất thành công',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(
    @CurrentUser()
    authUser: AuthUser,
  ) {
    return this.authService.getMe(
      authUser.sub,
    );
  }
}