import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';
import { Department } from '../../departments/entities/department.entity';
import { UserRole } from '../../user-roles/entities/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  username: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({
    name: 'full_name',
    type: 'varchar',
    length: 255,
  })
  fullName: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  phone: string | null;

  @Column({
    name: 'organization_id',
    type: 'uuid',
    nullable: true,
  })
  organizationId: string | null;

  @ManyToOne(() => Organization, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'organization_id',
  })
  organization: Organization | null;

  @Column({
    name: 'department_id',
    type: 'uuid',
    nullable: true,
  })
  departmentId: string | null;

  @ManyToOne(() => Department, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'department_id',
  })
  department: Department | null;

  @Column({
    name: 'job_title',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  jobTitle: string | null;

  @Column({
    name: 'avatar_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatarUrl: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @Column({
    name: 'is_locked',
    type: 'boolean',
    default: false,
  })
  isLocked: boolean;

  @Column({
    name: 'last_login_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastLoginAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;

  @OneToMany(
    () => UserRole,
    (userRole) => userRole.user,
  )
  userRoles: UserRole[];
}