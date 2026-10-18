import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const TASK_STATUSES = ['NEW','ASSIGNED','IN_PROGRESS','PENDING_REVIEW','COMPLETED','CANCELLED'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(100) taskCode?: string;
  @IsUUID() organizationId!: string;
  @IsOptional() @IsUUID() documentId?: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsUUID() parentTaskId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) priority?: number;
  @IsOptional() @IsBoolean() isImportant?: boolean;
  @IsOptional() @IsBoolean() isConfidential?: boolean;
}
export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional() @IsString() result?: string;
}
export class QueryTasksDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() documentId?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsIn(TASK_STATUSES) status?: TaskStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['true','false']) overdue?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsDateString() startDateFrom?: string;
  @IsOptional() @IsDateString() startDateTo?: string;
  @IsOptional() @IsDateString() dueDateFrom?: string;
  @IsOptional() @IsDateString() dueDateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
// Bộ lọc dùng chung cho thống kê/báo cáo (không phân trang).
export class QueryTaskReportDto extends OmitType(QueryTasksDto, ['page', 'limit'] as const) {
  @IsOptional() @IsIn(['department', 'responsible']) groupBy: 'department' | 'responsible' = 'department';
}
export class SetStatusDto {
  @IsIn(TASK_STATUSES) status!: TaskStatus;
  @IsOptional() @IsString() result?: string;
}
export class AssignTaskDto {
  @IsUUID() userId!: string;
  @IsIn(['MAIN','COORDINATE','FOLLOW']) assignmentType!: string;
  @IsOptional() @IsString() note?: string;
}
export class ProgressDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) progressPercent!: number;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() difficulties?: string;
  @IsOptional() @IsString() proposedSolution?: string;
}
export class CommentDto {
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsUUID() parentCommentId?: string;
}
