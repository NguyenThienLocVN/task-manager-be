import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        'Thiếu access token',
      );
    }

    if (
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException(
        'Access token không đúng định dạng',
      );
    }

    const token =
      authorization.substring(7);

    try {
      const payload =
        await this.jwtService.verifyAsync<AuthUser>(
          token,
          {
            secret: process.env.JWT_ACCESS_SECRET,
          },
        );

      if (payload.type !== 'access') {
        throw new UnauthorizedException(
          'Token không phải access token',
        );
      }

      request.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}