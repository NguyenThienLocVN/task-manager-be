import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskSecurityService } from '../tasks/security/task-security.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [JwtAuthGuard, TaskSecurityService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
