import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DocumentStatus } from '../document.entity';

export class CreateDocumentDto {
  @IsNotEmpty() @IsString() title: string;
  @IsOptional() @IsString() @MaxLength(100) documentNo?: string;
  @IsOptional() @IsDateString() documentDate?: string;
  @IsOptional() @IsString() @MaxLength(100) documentType?: string;
  @IsOptional() @IsString() @MaxLength(255) issuingAgency?: string;
  @IsOptional() @IsDateString() receivedDate?: string;
  // Production: obtain receivedBy from authenticated JWT, not arbitrary client input.
  @IsOptional() @IsUUID() receivedBy?: string;
  @IsOptional() @IsUUID() fieldId?: string;
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
}
