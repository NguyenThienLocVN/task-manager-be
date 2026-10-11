import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
  })
  userId: string;

  @PrimaryColumn({
    name: 'role_id',
    type: 'uuid',
  })
  roleId: string;

  @ManyToOne(
    () => User,
    (user) => user.userRoles,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'user_id',
  })
  user: User;

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
}