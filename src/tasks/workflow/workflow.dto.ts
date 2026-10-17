import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class RouteTaskDto {
 @IsIn(['DEPARTMENT','DIRECT']) routeType!: 'DEPARTMENT'|'DIRECT';
 @IsUUID() departmentId!: string;
 @IsOptional() @IsUUID() assigneeId?: string;
 @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class DelegateTaskDto {
 @IsUUID() assigneeId!: string;
 @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class ReviewTaskDto {
 @IsIn(['APPROVE','REJECT']) decision!: 'APPROVE'|'REJECT';
 @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}
export class SubmitTaskDto {
 @IsOptional() @IsString() @MaxLength(10000) result?: string;
}
