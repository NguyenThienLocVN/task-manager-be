import {
  Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { TaskSecurityService } from './security/task-security.service';
import { TasksService } from './tasks.service';
import {
  CommentDto, CreateTaskDto, ProgressDto, QueryTaskReportDto, QueryTasksDto, UpdateTaskDto,
} from './dto/tasks.dto';

const TASK_VIEW_PERMISSIONS = [
  'TASK_VIEW_ALL', 'TASK_VIEW_DEPARTMENT', 'TASK_VIEW_ASSIGNED',
] as const;

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly service: TasksService,
    private readonly security: TaskSecurityService,
  ) {}

  private async authorize(user: AuthUser, permission: string) {
    const actor = await this.security.actor(user);
    await this.security.requirePermission(actor, permission);
    return actor;
  }

  // Tương thích TaskSecurityService hiện tại, không yêu cầu thêm method mới.
  // Đây chỉ là kiểm tra quyền truy cập endpoint; Service PHẢI lọc phạm vi dữ liệu.
  private async authorizeAny(
    user: AuthUser,
    permissions: readonly string[],
    allowDepartmentViewer = true,
  ) {
    const actor = await this.security.actor(user);
    for (const permission of permissions) {
      try {
        await this.security.requirePermission(actor, permission);
        return actor;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    if (
      allowDepartmentViewer &&
      await this.security.canViewDepartment(actor, actor.departmentId)
    ) return actor;
    throw new ForbiddenException(
      `Thiếu một trong các quyền: ${permissions.join(', ')}`,
    );
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.service.create(await this.authorize(user, 'TASK_CREATE'), dto);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: QueryTasksDto) {
    return this.service.list(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), q);
  }

  @Get('my-tasks')
  async mine(@CurrentUser() user: AuthUser, @Query() q: QueryTasksDto) {
    return this.service.list(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), q, true);
  }

  @Get('statistics')
  async stats(@CurrentUser() user: AuthUser, @Query() q: QueryTasksDto) {
    return this.service.statistics(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), q);
  }

  @Get('statistics/report')
  async report(@CurrentUser() user: AuthUser, @Query() q: QueryTaskReportDto) {
    return this.service.report(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), q);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.update(await this.authorize(user, 'TASK_UPDATE'), id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(await this.authorize(user, 'TASK_DELETE'), id);
  }

  @Get(':id/subtasks')
  async subtasks(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.subtasks(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id);
  }

  @Get(':id/assignments')
  async assignments(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.children(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id, 'task_assignments');
  }

  @Get(':id/progress')
  async progress(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.children(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id, 'task_progress');
  }

  @Post(':id/progress')
  async addProgress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProgressDto,
  ) {
    return this.service.addProgress(await this.authorize(user, 'TASK_UPDATE_PROGRESS'), id, dto);
  }

  @Get(':id/comments')
  async comments(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.children(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id, 'task_comments');
  }

  @Post(':id/comments')
  async comment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentDto,
  ) {
    // Không có TASK_COMMENT trong DB hiện tại; yêu cầu quyền xem.
    // TasksService.comment PHẢI kiểm tra người dùng có quyền trao đổi trong công việc này.
    return this.service.comment(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS, false), id, dto);
  }

  @Get(':id/history')
  async history(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.children(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id, 'task_history');
  }
}
