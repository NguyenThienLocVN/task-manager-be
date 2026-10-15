import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum DocumentStatus {
  RECEIVED = 'RECEIVED',
  CLASSIFIED = 'CLASSIFIED',
  ASSIGNED = 'ASSIGNED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'document_no', type: 'varchar', length: 100, nullable: true }) documentNo: string | null;
  @Column({ name: 'document_date', type: 'date', nullable: true }) documentDate: string | null;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'document_type', type: 'varchar', length: 100, nullable: true }) documentType: string | null;
  @Column({ name: 'issuing_agency', type: 'varchar', length: 255, nullable: true }) issuingAgency: string | null;
  @Column({ name: 'received_date', type: 'date', nullable: true }) receivedDate: string | null;
  @Column({ name: 'file_url', type: 'text', nullable: true }) fileUrl: string | null;
  @Column({ name: 'received_by', type: 'uuid', nullable: true }) receivedBy: string | null;
  @Column({ name: 'field_id', type: 'uuid', nullable: true }) fieldId: string | null;
  @Column({ type: 'varchar', length: 30, default: DocumentStatus.RECEIVED }) status: DocumentStatus;
  @Column({ name: 'file_name', type: 'text', nullable: true }) fileName: string | null;
  @Column({ name: 'storage_key', type: 'text', nullable: true, unique: true }) storageKey: string | null;
  @Column({ name: 'mime_type', type: 'varchar', length: 150, nullable: true }) mimeType: string | null;
  @Column({ name: 'file_size', type: 'bigint', nullable: true }) fileSize: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
