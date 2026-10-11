import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { OneToMany } from 'typeorm';

import { RolePermission } from '../../role-permissions/entities/role-permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'is_system',
    type: 'boolean',
    default: false,
  })
  isSystem: boolean;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.role,
  )
  rolePermissions: RolePermission[];
}