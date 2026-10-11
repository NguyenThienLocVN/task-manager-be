import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { RolePermission } from './entities/role-permission.entity';

import { Role } from '../roles/entities/role.entity';

import { Permission } from '../permissions/entities/permission.entity';

import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository:
      Repository<RolePermission>,

    @InjectRepository(Role)
    private readonly roleRepository:
      Repository<Role>,

    @InjectRepository(Permission)
    private readonly permissionRepository:
      Repository<Permission>,
  ) {}

  async getByRole(roleId: string) {
    const role =
      await this.roleRepository.findOne({
        where: {
          id: roleId,
        },
      });

    if (!role) {
      throw new NotFoundException(
        'Không tìm thấy vai trò',
      );
    }

    const rolePermissions =
      await this.rolePermissionRepository.find({
        where: {
          roleId,
        },

        relations: {
          permission: true,
        },
      });

    return rolePermissions
      .map(
        (item) => item.permission,
      )
      .sort((a, b) => {
        if (
          a.module === b.module
        ) {
          return a.code.localeCompare(
            b.code,
          );
        }

        return a.module.localeCompare(
          b.module,
        );
      });
  }

  async updatePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ) {
    const role =
      await this.roleRepository.findOne({
        where: {
          id: roleId,
        },
      });

    if (!role) {
      throw new NotFoundException(
        'Không tìm thấy vai trò',
      );
    }

    const permissionIds =
      dto.permissionIds ?? [];

    if (permissionIds.length > 0) {
      const permissions =
        await this.permissionRepository.find({
          where: {
            id: In(permissionIds),
          },
        });

      if (
        permissions.length !==
        permissionIds.length
      ) {
        throw new BadRequestException(
          'Có quyền không tồn tại',
        );
      }

      const inactive =
        permissions.filter(
          (permission) =>
            !permission.isActive,
        );

      if (inactive.length > 0) {
        throw new BadRequestException(
          'Có quyền đang ngừng hoạt động',
        );
      }
    }

    await this.rolePermissionRepository.manager.transaction(
      async (manager) => {
        await manager.delete(
          RolePermission,
          {
            roleId,
          },
        );

        if (
          permissionIds.length > 0
        ) {
          const entities =
            permissionIds.map(
              (permissionId) =>
                manager.create(
                  RolePermission,
                  {
                    roleId,
                    permissionId,
                  },
                ),
            );

          await manager.save(
            RolePermission,
            entities,
          );
        }
      },
    );

    return this.getByRole(roleId);
  }

  async addPermission(
    roleId: string,
    permissionId: string,
  ) {
    const role =
      await this.roleRepository.findOne({
        where: {
          id: roleId,
        },
      });

    if (!role) {
      throw new NotFoundException(
        'Không tìm thấy vai trò',
      );
    }

    const permission =
      await this.permissionRepository.findOne({
        where: {
          id: permissionId,
        },
      });

    if (!permission) {
      throw new NotFoundException(
        'Không tìm thấy quyền',
      );
    }

    if (!permission.isActive) {
      throw new BadRequestException(
        'Không thể gán quyền đang ngừng hoạt động',
      );
    }

    const existed =
      await this.rolePermissionRepository.findOne({
        where: {
          roleId,
          permissionId,
        },
      });

    if (!existed) {
      const entity =
        this.rolePermissionRepository.create({
          roleId,
          permissionId,
        });

      await this.rolePermissionRepository.save(
        entity,
      );
    }

    return this.getByRole(roleId);
  }

  async removePermission(
    roleId: string,
    permissionId: string,
  ) {
    const existed =
      await this.rolePermissionRepository.findOne({
        where: {
          roleId,
          permissionId,
        },
      });

    if (!existed) {
      throw new NotFoundException(
        'Vai trò chưa được gán quyền này',
      );
    }

    await this.rolePermissionRepository.remove(
      existed,
    );

    return this.getByRole(roleId);
  }
}