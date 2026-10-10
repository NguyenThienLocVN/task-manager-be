import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';

@Entity('departments')
@Index(['organizationId', 'code'], {
  unique: true,
})
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'organization_id',
    type: 'uuid',
  })
  organizationId: string;

  @ManyToOne(
    () => Organization,
    (organization) => organization.departments,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({
    name: 'organization_id',
  })
  organization: Organization;

  @Column({
    name: 'parent_id',
    type: 'uuid',
    nullable: true,
  })
  parentId: string | null;

  @ManyToOne(
    () => Department,
    (department) => department.children,
    {
      nullable: true,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({
    name: 'parent_id',
  })
  parent: Department | null;

  @OneToMany(
    () => Department,
    (department) => department.parent,
  )
  children: Department[];

  @Column({
    type: 'varchar',
    length: 50,
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  @Column({
    name: 'department_type',
    type: 'varchar',
    length: 50,
  })
  departmentType: string;

  @Column({
    name: 'sort_order',
    type: 'int',
    default: 0,
  })
  sortOrder: number;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}