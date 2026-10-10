import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Department } from './entities/department.entity';
import { Organization } from '../organizations/entities/organization.entity';

import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository:
      Repository<Department>,

    @InjectRepository(Organization)
    private readonly organizationRepository:
      Repository<Organization>,
  ) {}

  async create(
    dto: CreateDepartmentDto,
  ) {
    const organization =
      await this.organizationRepository.findOne({
        where: {
          id: dto.organizationId,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Cơ quan không tồn tại',
      );
    }

    const code =
      dto.code.trim().toUpperCase();

    const existed =
      await this.departmentRepository.findOne({
        where: {
          organizationId:
            dto.organizationId,

          code,
        },
      });

    if (existed) {
      throw new ConflictException(
        `Mã phòng ban ${code} đã tồn tại trong cơ quan`,
      );
    }

    if (dto.parentId) {
      const parent =
        await this.departmentRepository.findOne({
          where: {
            id: dto.parentId,
          },
        });

      if (!parent) {
        throw new NotFoundException(
          'Phòng ban cấp trên không tồn tại',
        );
      }

      if (
        parent.organizationId !==
        dto.organizationId
      ) {
        throw new BadRequestException(
          'Phòng ban cấp trên phải thuộc cùng cơ quan',
        );
      }
    }

    const department =
      this.departmentRepository.create({
        organizationId:
          dto.organizationId,

        parentId:
          dto.parentId ?? null,

        code,

        name:
          dto.name.trim(),

        departmentType:
          dto.departmentType,

        sortOrder:
          dto.sortOrder ?? 0,

        isActive:
          dto.isActive ?? true,
      });

    return this.departmentRepository.save(
      department,
    );
  }

  async findByOrganization(
    organizationId: string,
  ) {
    return this.departmentRepository.find({
      where: {
        organizationId,
      },

      relations: {
        parent: true,
      },

      order: {
        sortOrder: 'ASC',
        name: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const department =
      await this.departmentRepository.findOne({
        where: {
          id,
        },

        relations: {
          organization: true,
          parent: true,
          children: true,
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Không tìm thấy phòng ban',
      );
    }

    return department;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const department =
      await this.findOne(id);

    const organizationId =
      dto.organizationId ??
      department.organizationId;

    if (dto.organizationId) {
      const organization =
        await this.organizationRepository.findOne({
          where: {
            id: dto.organizationId,
          },
        });

      if (!organization) {
        throw new NotFoundException(
          'Cơ quan không tồn tại',
        );
      }
    }

    if (dto.code) {
      const code =
        dto.code.trim().toUpperCase();

      const existed =
        await this.departmentRepository
          .createQueryBuilder('department')
          .where(
            'department.organizationId = :organizationId',
            {
              organizationId,
            },
          )
          .andWhere(
            'department.code = :code',
            {
              code,
            },
          )
          .andWhere(
            'department.id != :id',
            {
              id,
            },
          )
          .getOne();

      if (existed) {
        throw new ConflictException(
          `Mã phòng ban ${code} đã tồn tại`,
        );
      }

      dto.code = code;
    }

    if (
      dto.parentId !== undefined
    ) {
      await this.validateParent(
        department.id,
        organizationId,
        dto.parentId,
      );
    }

    Object.assign(
      department,
      dto,
    );

    return this.departmentRepository.save(
      department,
    );
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ) {
    const department =
      await this.findOne(id);

    department.isActive =
      isActive;

    return this.departmentRepository.save(
      department,
    );
  }

  async remove(id: string) {
    const department =
      await this.findOne(id);

    if (
      department.children?.length > 0
    ) {
      throw new BadRequestException(
        'Không thể xóa phòng ban đang có đơn vị cấp dưới',
      );
    }

    await this.departmentRepository.remove(
      department,
    );

    return {
      message:
        'Xóa phòng ban thành công',
    };
  }

  private async validateParent(
    departmentId: string,
    organizationId: string,
    parentId?: string | null,
  ) {
    if (!parentId) {
      return;
    }

    if (
      departmentId === parentId
    ) {
      throw new BadRequestException(
        'Phòng ban không thể là cấp trên của chính nó',
      );
    }

    const parent =
      await this.departmentRepository.findOne({
        where: {
          id: parentId,
        },
      });

    if (!parent) {
      throw new NotFoundException(
        'Phòng ban cấp trên không tồn tại',
      );
    }

    if (
      parent.organizationId !==
      organizationId
    ) {
      throw new BadRequestException(
        'Phòng ban cấp trên phải thuộc cùng cơ quan',
      );
    }

    const isDescendant =
      await this.isDescendant(
        parentId,
        departmentId,
      );

    if (isDescendant) {
      throw new BadRequestException(
        'Không thể chọn phòng ban cấp dưới làm phòng ban cấp trên',
      );
    }
  }

  private async isDescendant(
    departmentId: string,
    possibleAncestorId: string,
  ): Promise<boolean> {
    let currentId: string | null =
      departmentId;

    while (currentId) {
      if (
        currentId ===
        possibleAncestorId
      ) {
        return true;
      }

      const current =
        await this.departmentRepository.findOne({
          where: {
            id: currentId,
          },
        });

      currentId =
        current?.parentId ?? null;
    }

    return false;
  }
}