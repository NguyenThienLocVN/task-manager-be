import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from './entities/role.entity';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(dto: CreateRoleDto) {
    const code = dto.code.trim().toUpperCase();

    const existed = await this.roleRepository.findOne({
      where: {
        code,
      },
    });

    if (existed) {
      throw new ConflictException(
        `Mã vai trò ${code} đã tồn tại`,
      );
    }

    const role = this.roleRepository.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isSystem: dto.isSystem ?? false,
      isActive: dto.isActive ?? true,
    });

    return this.roleRepository.save(role);
  }

  async findAll(queryDto: QueryRoleDto) {
    const query = this.roleRepository
      .createQueryBuilder('role');

    if (queryDto.keyword?.trim()) {
      const keyword = `%${queryDto.keyword.trim()}%`;

      query.andWhere(
        `(
          LOWER(role.code) LIKE LOWER(:keyword)
          OR
          LOWER(role.name) LIKE LOWER(:keyword)
          OR
          LOWER(COALESCE(role.description, '')) LIKE LOWER(:keyword)
        )`,
        {
          keyword,
        },
      );
    }

    if (queryDto.isActive !== undefined) {
      query.andWhere(
        'role.is_active = :isActive',
        {
          isActive:
            queryDto.isActive === 'true',
        },
      );
    }

    if (queryDto.isSystem !== undefined) {
      query.andWhere(
        'role.is_system = :isSystem',
        {
          isSystem:
            queryDto.isSystem === 'true',
        },
      );
    }

    query.orderBy(
      'role.is_system',
      'DESC',
    );

    query.addOrderBy(
      'role.name',
      'ASC',
    );

    return query.getMany();
  }

  async findOne(id: string) {
    const role =
      await this.roleRepository.findOne({
        where: {
          id,
        },
      });

    if (!role) {
      throw new NotFoundException(
        'Không tìm thấy vai trò',
      );
    }

    return role;
  }

  async findByCode(code: string) {
    const role =
      await this.roleRepository.findOne({
        where: {
          code: code.trim().toUpperCase(),
        },
      });

    if (!role) {
      throw new NotFoundException(
        `Không tìm thấy vai trò ${code}`,
      );
    }

    return role;
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
  ) {
    const role = await this.findOne(id);

    if (dto.code) {
      const code =
        dto.code.trim().toUpperCase();

      const existed =
        await this.roleRepository
          .createQueryBuilder('role')
          .where(
            'role.code = :code',
            {
              code,
            },
          )
          .andWhere(
            'role.id != :id',
            {
              id,
            },
          )
          .getOne();

      if (existed) {
        throw new ConflictException(
          `Mã vai trò ${code} đã tồn tại`,
        );
      }

      /*
       * Khuyến nghị:
       * Không cho đổi code của role hệ thống.
       */
      if (
        role.isSystem &&
        code !== role.code
      ) {
        throw new BadRequestException(
          'Không được thay đổi mã của vai trò hệ thống',
        );
      }

      role.code = code;
    }

    if (dto.name !== undefined) {
      role.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      role.description =
        dto.description.trim() || null;
    }

    if (dto.isActive !== undefined) {
      role.isActive = dto.isActive;
    }

    return this.roleRepository.save(role);
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ) {
    const role = await this.findOne(id);

    /*
     * Nếu muốn bảo vệ role hệ thống tuyệt đối,
     * có thể không cho disable.
     */
    if (
      role.isSystem &&
      !isActive
    ) {
      throw new BadRequestException(
        'Không được vô hiệu hóa vai trò hệ thống',
      );
    }

    role.isActive = isActive;

    return this.roleRepository.save(role);
  }

  async remove(id: string) {
    const role = await this.findOne(id);

    if (role.isSystem) {
      throw new BadRequestException(
        'Không được xóa vai trò hệ thống',
      );
    }

    /*
     * Sau này khi có bảng user_roles,
     * cần kiểm tra role có đang được gán cho user hay không.
     */

    await this.roleRepository.remove(role);

    return {
      message: 'Xóa vai trò thành công',
    };
  }
}