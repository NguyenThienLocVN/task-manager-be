import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsUUID()
  @IsOptional()
  organizationId?: string | null;

  @IsUUID()
  @IsOptional()
  departmentId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  jobTitle?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;
}