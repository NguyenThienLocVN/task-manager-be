import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsIn([
    'PHONG',
    'BAN',
    'TRUNG_TAM',
    'BO_PHAN',
    'TO',
    'KHAC',
  ])
  departmentType: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}