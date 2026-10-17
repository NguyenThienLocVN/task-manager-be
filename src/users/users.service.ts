import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';

import { Role } from '../roles/entities/role.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Department } from '../departments/entities/department.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository:
      Repository<User>,

    @InjectRepository(UserRole)
    private readonly userRoleRepository:
      Repository<UserRole>,

    @InjectRepository(Role)
    private readonly roleRepository:
      Repository<Role>,

    @InjectRepository(Organization)
    private readonly organizationRepository:
      Repository<Organization>,

    @InjectRepository(Department)
    private readonly departmentRepository:
      Repository<Department>,
  ) {}

  async create(dto: CreateUserDto) {
    const username =
      dto.username.trim().toLowerCase();

    const existed =
      await this.userRepository.findOne({
        where: {
          username,
        },
      });

    if (existed) {
      throw new ConflictException(
        'Tên đăng nhập đã tồn tại',
      );
    }

    let organizationId:
      | string
      | null =
      dto.organizationId ?? null;

    const departmentId:
      | string
      | null =
      dto.departmentId ?? null;

    // Kiểm tra organization
    if (organizationId) {
      await this.validateOrganization(
        organizationId,
      );
    }

    // Kiểm tra department
    if (departmentId) {
      const department =
        await this.departmentRepository.findOne({
          where: {
            id: departmentId,
          },
        });

      if (!department) {
        throw new NotFoundException(
          'Phòng ban không tồn tại',
        );
      }

      // Nếu frontend gửi organizationId
      // thì kiểm tra department có thuộc organization đó không
      if (
        organizationId &&
        department.organizationId !==
          organizationId
      ) {
        throw new BadRequestException(
          'Phòng ban không thuộc cơ quan đã chọn',
        );
      }

      // Nếu không truyền organizationId
      // thì tự lấy từ phòng ban
      if (!organizationId) {
        organizationId =
          department.organizationId;
      }
    }

    const passwordHash =
      await bcrypt.hash(
        dto.password,
        12,
      );

    const user =
      this.userRepository.create({
        username,

        passwordHash,

        fullName:
          dto.fullName.trim(),

        email:
          dto.email?.trim() || null,

        phone:
          dto.phone?.trim() || null,

        organizationId,

        departmentId,

        jobTitle:
          dto.jobTitle?.trim() || null,

        avatarUrl:
          dto.avatarUrl?.trim() || null,

        isActive:
          dto.isActive ?? true,

        isLocked:
          false,
      });

    const saved =
      await this.userRepository.save(
        user,
      );

    return this.findOne(saved.id);
  }

  async findAll(
    dto: QueryUserDto,
  ) {
    const query =
      this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect(
          'user.organization',
          'organization',
        )
        .leftJoinAndSelect(
          'user.department',
          'department',
        )
        .leftJoinAndSelect(
          'user.userRoles',
          'userRole',
        )
        .leftJoinAndSelect(
          'userRole.role',
          'role',
        );

    if (dto.keyword?.trim()) {
      const keyword =
        `%${dto.keyword.trim()}%`;

      query.andWhere(
        `(
          LOWER(user.username)
            LIKE LOWER(:keyword)
          OR
          LOWER(user.full_name)
            LIKE LOWER(:keyword)
          OR
          LOWER(COALESCE(user.email, ''))
            LIKE LOWER(:keyword)
          OR
          LOWER(COALESCE(user.phone, ''))
            LIKE LOWER(:keyword)
        )`,
        {
          keyword,
        },
      );
    }

    if (dto.organizationId) {
      query.andWhere(
        'user.organization_id = :organizationId',
        {
          organizationId:
            dto.organizationId,
        },
      );
    }

    if (dto.departmentId) {
      query.andWhere(
        'user.department_id = :departmentId',
        {
          departmentId:
            dto.departmentId,
        },
      );
    }

    if (dto.roleId) {
      query.andWhere(
        'role.id = :roleId',
        {
          roleId: dto.roleId,
        },
      );
    }

    if (dto.isActive !== undefined) {
      query.andWhere(
        'user.is_active = :isActive',
        {
          isActive:
            dto.isActive === 'true',
        },
      );
    }

    if (dto.isLocked !== undefined) {
      query.andWhere(
        'user.is_locked = :isLocked',
        {
          isLocked:
            dto.isLocked === 'true',
        },
      );
    }

    query.orderBy(
      'user.full_name',
      'ASC',
    );

    return query.getMany();
  }

  async findOne(id: string) {
    const user =
      await this.userRepository.findOne({
        where: {
          id,
        },

        relations: {
          organization: true,
          department: true,
          userRoles: {
            role: true,
          },
        },
      });

    if (!user) {
      throw new NotFoundException(
        'Không tìm thấy người dùng',
      );
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
  ) {
    const user = await this.findOne(id);

    if (dto.username) {
      const username = dto.username.trim().toLowerCase();

      const existed =
        await this.userRepository.createQueryBuilder('user').where('user.username = :username',
            {
              username,
            },
          )
          .andWhere('user.id != :id',
            {
              id,
            },
          ).getOne();

      if (existed) {
        throw new ConflictException(
          'Tên đăng nhập đã tồn tại',
        );
      }

      user.username = username;
    }

    const organizationId =
      dto.organizationId !== undefined
        ? dto.organizationId
        : user.organizationId;

    const departmentId =
      dto.departmentId !== undefined
        ? dto.departmentId
        : user.departmentId;

    if (organizationId) {
      await this.validateOrganization(
        organizationId,
      );
    }

    const department = departmentId
      ? await this.validateDepartment(
        departmentId,
        organizationId,
      )
      : null;

    if (dto.fullName !== undefined) {
      user.fullName =
        dto.fullName.trim();
    }

    if (dto.email !== undefined) {
      user.email =
        dto.email?.trim() || null;
    }

    if (dto.phone !== undefined) {
      user.phone =
        dto.phone?.trim() || null;
    }

    if (
      dto.organizationId !== undefined
    ) {
      user.organizationId =
        dto.organizationId;
    }

    if (
      dto.departmentId !== undefined
    ) {
      user.departmentId =
        dto.departmentId;
      user.department =
        department;
    }

    if (dto.jobTitle !== undefined) {
      user.jobTitle =
        dto.jobTitle?.trim() || null;
    }

    if (dto.avatarUrl !== undefined) {
      user.avatarUrl =
        dto.avatarUrl?.trim() || null;
    }

    if (dto.isActive !== undefined) {
      user.isActive =
        dto.isActive;
    }

    if (dto.isLocked !== undefined) {
      user.isLocked =
        dto.isLocked;
    }

    await this.userRepository.save(
      user,
    );

    return this.findOne(id);
  }

  async updateActiveStatus(
    id: string,
    isActive: boolean,
  ) {
    const user =
      await this.findOne(id);

    user.isActive = isActive;

    await this.userRepository.save(
      user,
    );

    return this.findOne(id);
  }

  async updateLockStatus(
    id: string,
    isLocked: boolean,
  ) {
    const user =
      await this.findOne(id);

    user.isLocked = isLocked;

    await this.userRepository.save(
      user,
    );

    return this.findOne(id);
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
  ) {
    const user =
      await this.userRepository
        .createQueryBuilder('user')
        .addSelect(
          'user.passwordHash',
        )
        .where(
          'user.id = :id',
          {
            id,
          },
        )
        .getOne();

    if (!user) {
      throw new NotFoundException(
        'Không tìm thấy người dùng',
      );
    }

    user.passwordHash =
      await bcrypt.hash(
        dto.newPassword,
        12,
      );

    await this.userRepository.save(
      user,
    );

    return {
      message:
        'Đặt lại mật khẩu thành công',
    };
  }

  async getRoles(
    userId: string,
  ) {
    await this.findOne(userId);

    const userRoles =
      await this.userRoleRepository.find({
        where: {
          userId,
        },

        relations: {
          role: true,
        },
      });

    return userRoles.map(
      (item) => item.role,
    );
  }

  async updateRoles(
    userId: string,
    dto: UpdateUserRolesDto,
  ) {
    await this.findOne(userId);

    const roleIds =
      dto.roleIds ?? [];

    if (roleIds.length > 0) {
      const roles =
        await this.roleRepository.find({
          where: {
            id: In(roleIds),
          },
        });

      if (
        roles.length !==
        roleIds.length
      ) {
        throw new BadRequestException(
          'Có roleId không tồn tại',
        );
      }

      const inactiveRoles =
        roles.filter(
          (role) =>
            !role.isActive,
        );

      if (
        inactiveRoles.length > 0
      ) {
        throw new BadRequestException({
          message:
            'Không thể gán vai trò đang ngừng hoạt động',

          roles:
            inactiveRoles.map(
              (role) => role.code,
            ),
        });
      }
    }

    await this.userRoleRepository.manager.transaction(
      async (manager) => {
        await manager.delete(
          UserRole,
          {
            userId,
          },
        );

        if (roleIds.length > 0) {
          const entities =
            roleIds.map(
              (roleId) =>
                manager.create(
                  UserRole,
                  {
                    userId,
                    roleId,
                  },
                ),
            );

          await manager.save(
            UserRole,
            entities,
          );
        }
      },
    );

    return this.getRoles(userId);
  }

  async remove(id: string) {
    const user =
      await this.findOne(id);

    await this.userRepository.remove(
      user,
    );

    return {
      message:
        'Xóa người dùng thành công',
    };
  }

  async updateLastLogin(
    id: string,
  ) {
    await this.userRepository.update(
      id,
      {
        lastLoginAt:
          new Date(),
      },
    );
  }

  private async validateOrganization(
    organizationId: string,
  ) {
    const organization =
      await this.organizationRepository.findOne({
        where: {
          id: organizationId,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Cơ quan không tồn tại',
      );
    }
  }

  private async validateDepartment(
  departmentId: string,
  organizationId?: string | null,
  ) {
    const department =
      await this.departmentRepository.findOne({
        where: {
          id: departmentId,
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Phòng ban không tồn tại',
      );
    }

    if (
      organizationId &&
      department.organizationId !== organizationId
    ) {
      throw new BadRequestException(
        'Phòng ban không thuộc cơ quan đã chọn',
      );
    }

    return department;
  }
}