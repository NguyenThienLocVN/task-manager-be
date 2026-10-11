import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({
    name: 'role_id',
    type: 'uuid',
  })
  roleId: string;

  @PrimaryColumn({
    name: 'permission_id',
    type: 'uuid',
  })
  permissionId: string;

  @ManyToOne(
    () => Role,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'role_id',
  })
  role: Role;

  @ManyToOne(
    () => Permission,
    (permission) => permission.rolePermissions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'permission_id',
  })
  permission: Permission;
}