import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class QueryPermissionDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  module?: string;

  @IsBooleanString()
  @IsOptional()
  isActive?: string;
}