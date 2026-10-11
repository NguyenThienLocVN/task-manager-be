import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class QueryRoleDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsBooleanString()
  @IsOptional()
  isActive?: string;

  @IsBooleanString()
  @IsOptional()
  isSystem?: string;
}