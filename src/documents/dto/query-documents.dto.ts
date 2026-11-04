import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { DocumentStatus } from '../document.entity';
import { DocumentDirection } from './document-direction.enum';
export class QueryDocumentsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
  @IsOptional() @IsEnum(DocumentDirection) direction?: DocumentDirection;
  @IsOptional() @IsUUID() fieldId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
