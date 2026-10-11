import { IsBooleanString, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryUserDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsBooleanString()
  @IsOptional()
  isActive?: string;

  @IsBooleanString()
  @IsOptional()
  isLocked?: string;
}