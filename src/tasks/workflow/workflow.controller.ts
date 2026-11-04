import {
  Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Res,
  Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { multerOptions, openStoredFile } from '../../documents/file-storage';
import { TaskSecurityService } from '../security/task-security.service';
import { TasksService } from '../tasks.service';
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
    private readonly tasks: TasksService,
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
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitTaskDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.submit(await this.authorize(user, 'TASK_SUBMIT'), id, dto, file);
  }

  @Get(':id/result-files/:fileId/download')
  async downloadResultFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.tasks.resultFile(
      await this.authorizeAny(user, TASK_VIEW_PERMISSIONS),
      id,
      fileId,
    );
    const { stream, length } = await openStoredFile(file.storage_key);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="result-file"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
    );
    return new StreamableFile(stream, { type: file.mime_type, length });
  }

  @Post(':id/review')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewTaskDto,
  ) {
    // Quyền duyệt (người giao, trưởng phòng hoặc TASK_APPROVE) được kiểm tra trong WorkflowService.review.
    return this.service.review(await this.security.actor(user), id, dto);
  }

  @Get(':id/routes')
  async routes(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.routes(await this.authorizeAny(user, TASK_VIEW_PERMISSIONS), id);
  }
}
