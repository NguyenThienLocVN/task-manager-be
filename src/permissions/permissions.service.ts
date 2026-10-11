import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Permission } from './entities/permission.entity';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { QueryPermissionDto } from './dto/query-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository:
      Repository<Permission>,
  ) {}

  async create(dto: CreatePermissionDto) {
    const code =
      dto.code.trim().toUpperCase();

    const existed =
      await this.permissionRepository.findOne({
        where: {
          code,
        },
      });

    if (existed) {
      throw new ConflictException(
        `Mã quyền ${code} đã tồn tại`,
      );
    }

    const permission =
      this.permissionRepository.create({
        code,
        name: dto.name.trim(),
        module:
          dto.module.trim().toUpperCase(),

        description:
          dto.description?.trim() || null,

        isActive:
          dto.isActive ?? true,
      });

    return this.permissionRepository.save(
      permission,
    );
  }

  async findAll(
    queryDto: QueryPermissionDto,
  ) {
    const query =
      this.permissionRepository
        .createQueryBuilder('permission');

    if (queryDto.keyword?.trim()) {
      const keyword =
        `%${queryDto.keyword.trim()}%`;

      query.andWhere(
        `(
          LOWER(permission.code)
            LIKE LOWER(:keyword)

          OR

          LOWER(permission.name)
            LIKE LOWER(:keyword)

          OR

          LOWER(
            COALESCE(
              permission.description,
              ''
            )
          )
            LIKE LOWER(:keyword)
        )`,
        {
          keyword,
        },
      );
    }

    if (queryDto.module?.trim()) {
      query.andWhere(
        'permission.module = :module',
        {
          module:
            queryDto.module
              .trim()
              .toUpperCase(),
        },
      );
    }

    if (
      queryDto.isActive !== undefined
    ) {
      query.andWhere(
        'permission.is_active = :isActive',
        {
          isActive:
            queryDto.isActive === 'true',
        },
      );
    }

    query.orderBy(
      'permission.module',
      'ASC',
    );

    query.addOrderBy(
      'permission.code',
      'ASC',
    );

    return query.getMany();
  }

  async findOne(id: string) {
    const permission =
      await this.permissionRepository.findOne({
        where: {
          id,
        },
      });

    if (!permission) {
      throw new NotFoundException(
        'Không tìm thấy quyền',
      );
    }

    return permission;
  }

  async findByCode(code: string) {
    const permission =
      await this.permissionRepository.findOne({
        where: {
          code:
            code.trim().toUpperCase(),
        },
      });

    if (!permission) {
      throw new NotFoundException(
        `Không tìm thấy quyền ${code}`,
      );
    }

    return permission;
  }

  async update(
    id: string,
    dto: UpdatePermissionDto,
  ) {
    const permission =
      await this.findOne(id);

    if (dto.code) {
      const code =
        dto.code.trim().toUpperCase();

      const existed =
        await this.permissionRepository
          .createQueryBuilder(
            'permission',
          )
          .where(
            'permission.code = :code',
            {
              code,
            },
          )
          .andWhere(
            'permission.id != :id',
            {
              id,
            },
          )
          .getOne();

      if (existed) {
        throw new ConflictException(
          `Mã quyền ${code} đã tồn tại`,
        );
      }

      permission.code = code;
    }

    if (dto.name !== undefined) {
      permission.name =
        dto.name.trim();
    }

    if (dto.module !== undefined) {
      permission.module =
        dto.module
          .trim()
          .toUpperCase();
    }

    if (
      dto.description !== undefined
    ) {
      permission.description =
        dto.description.trim() || null;
    }

    if (
      dto.isActive !== undefined
    ) {
      permission.isActive =
        dto.isActive;
    }

    return this.permissionRepository.save(
      permission,
    );
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ) {
    const permission =
      await this.findOne(id);

    permission.isActive =
      isActive;

    return this.permissionRepository.save(
      permission,
    );
  }

  async remove(id: string) {
    const permission =
      await this.permissionRepository.findOne({
        where: {
          id,
        },

        relations: {
          rolePermissions: true,
        },
      });

    if (!permission) {
      throw new NotFoundException(
        'Không tìm thấy quyền',
      );
    }

    if (
      permission.rolePermissions.length > 0
    ) {
      throw new BadRequestException(
        'Quyền đang được gán cho vai trò và không thể xóa',
      );
    }

    await this.permissionRepository.remove(
      permission,
    );

    return {
      message:
        'Xóa quyền thành công',
    };
  }
}