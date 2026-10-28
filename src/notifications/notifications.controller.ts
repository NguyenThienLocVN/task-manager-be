import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { TaskSecurityService } from '../tasks/security/task-security.service';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly security: TaskSecurityService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: QueryNotificationsDto) {
    return this.service.list(await this.security.actor(user), q);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(await this.security.actor(user));
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(await this.security.actor(user));
  }

  @Delete('read')
  async removeRead(@CurrentUser() user: AuthUser) {
    return this.service.removeRead(await this.security.actor(user));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(await this.security.actor(user), id);
  }

  @Patch(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.setRead(await this.security.actor(user), id, true);
  }

  @Patch(':id/unread')
  async unread(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.setRead(await this.security.actor(user), id, false);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(await this.security.actor(user), id);
  }
}
