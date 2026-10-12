import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}