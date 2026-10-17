import {
  Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe,
  Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { TaskSecurityService } from '../security/task-security.service';
import { WorkflowService } from './workflow.service';
import {
  DelegateTaskDto, ReviewTaskDto, RouteTaskDto, SubmitTaskDto,
} from './workflow.dto';

const TASK_VIEW_PERMISSIONS = [
  'TASK_VIEW_ALL', 'TASK_VIEW_DEPARTMENT', 'TASK_VIEW_ASSIGNED',
] as const;

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private readonly service: WorkflowService,
    private readonly security: TaskSecurityService,
  ) {}

  private async authorize(user: AuthUser, permission: string) {
    const actor = await this.security.actor(user);
    await this.security.requirePermission(actor, permission);
    return actor;
  }

  private async authorizeAny(user: AuthUser, permissions: readonly string[]) {
    const actor = await this.security.actor(user);
    for (const permission of permissions) {
      try {
        await this.security.requirePermission(actor, permission);
        return actor;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    if (await this.security.canViewDepartment(actor, actor.departmentId)) return actor;
    throw new ForbiddenException(
      `Thiếu một trong các quyền: ${permissions.join(', ')}`,
    );
  }

  @Get('workflow/my-inbox')
  async inbox(@CurrentUser() user: AuthUser) {
    // WorkflowService.inbox phải chỉ trả về hàng chờ của người đăng nhập.
    return this.service.inbox(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS));
  }

  @Post(':id/route')
  async route(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RouteTaskDto,
  ) {
    // Giao lại công việc cần TASK_REASSIGN: phải kiểm tra ở WorkflowService.route
    // khi có tuyến giao hiện hành; không được coi TASK_ASSIGN là quyền giao lại.
    return this.service.route(await this.authorize(user, 'TASK_ASSIGN'), id, dto);
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    // Không tạo quyền TASK_ACCEPT mới; Service PHẢI xác nhận đúng người nhận.
    return this.service.accept(await this.security.actor(user), id);
  }

  @Post(':id/delegate')
  async delegate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DelegateTaskDto,
  ) {
    // WorkflowService.delegate PHẢI kiểm tra tư cách trưởng phòng và tuyến đã tiếp nhận.
    return this.service.delegate(await this.authorize(user, 'TASK_ASSIGN'), id, dto);
  }

  @Post(':id/submit-review')
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitTaskDto,
  ) {
    return this.service.submit(await this.authorize(user, 'TASK_SUBMIT'), id, dto);
  }

  @Post(':id/review')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewTaskDto,
  ) {
    return this.service.review(await this.authorize(user, 'TASK_APPROVE'), id, dto);
  }

  @Get(':id/routes')
  async routes(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.routes(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id);
  }
}
