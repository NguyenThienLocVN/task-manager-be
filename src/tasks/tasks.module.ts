import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkflowService } from './workflow/workflow.service';
import { WorkflowController } from './workflow/workflow.controller';
import { TaskSecurityService } from './security/task-security.service';
import { MailModule } from '../mail/mail.module';
@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [TasksController, WorkflowController],
  providers: [JwtAuthGuard, TaskSecurityService, TasksService, WorkflowService],
  exports: [JwtAuthGuard, TaskSecurityService],
})
export class TasksModule {}
