import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateDepartmentDto {
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn([
    'PHONG',
    'BAN',
    'TRUNG_TAM',
    'BO_PHAN',
    'TO',
    'KHAC',
  ])
  departmentType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}