import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { Organization } from './entities/organization.entity';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async create(dto: CreateOrganizationDto) {
    const code = dto.code.trim().toUpperCase();

    const existed = await this.organizationRepository.findOne({
      where: {
        code,
      },
    });

    if (existed) {
      throw new ConflictException(
        `Mã cơ quan ${code} đã tồn tại`,
      );
    }

    const organization =
      this.organizationRepository.create({
        ...dto,
        code,
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
      });

    return this.organizationRepository.save(organization);
  }

  async findAll(
  keyword?: string,
  isActive?: boolean,
) {
  const query = this.organizationRepository
    .createQueryBuilder('organization')
    .addSelect((subQuery) => {
      return subQuery
        .select('COUNT(department.id)')
        .from('departments', 'department')
        .where(
          'department.organization_id = organization.id',
        );
    }, 'departmentCount');

  if (keyword?.trim()) {
    query.andWhere(
      `(
        LOWER(organization.code) LIKE LOWER(:keyword)
        OR
        LOWER(organization.name) LIKE LOWER(:keyword)
      )`,
      {
        keyword: `%${keyword.trim()}%`,
      },
    );
  }

  if (typeof isActive === 'boolean') {
    query.andWhere(
      'organization.is_active = :isActive',
      {
        isActive,
      },
    );
  }

  query.orderBy(
    'organization.name',
    'ASC',
  );

  const { entities, raw } =
    await query.getRawAndEntities();

  return entities.map(
    (organization, index) => ({
      ...organization,

      departmentCount: Number(
        raw[index]?.departmentCount ?? 0,
      ),
    }),
  );
}

  async findOne(id: string) {
    const organization =
      await this.organizationRepository.findOne({
        where: {
          id,
        },

        relations: {
          departments: true,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Không tìm thấy cơ quan',
      );
    }

    return organization;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
  ) {
    const organization =
      await this.findOne(id);

    if (dto.code) {
      const code =
        dto.code.trim().toUpperCase();

      const existed =
        await this.organizationRepository
          .createQueryBuilder('organization')
          .where(
            'organization.code = :code',
            {
              code,
            },
          )
          .andWhere(
            'organization.id != :id',
            {
              id,
            },
          )
          .getOne();

      if (existed) {
        throw new ConflictException(
          `Mã cơ quan ${code} đã tồn tại`,
        );
      }

      dto.code = code;
    }

    Object.assign(
      organization,
      dto,
    );

    return this.organizationRepository.save(
      organization,
    );
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ) {
    const organization =
      await this.findOne(id);

    organization.isActive = isActive;

    return this.organizationRepository.save(
      organization,
    );
  }

  async remove(id: string) {
    const organization =
      await this.findOne(id);

    if (
      organization.departments &&
      organization.departments.length > 0
    ) {
      throw new BadRequestException(
        'Không thể xóa cơ quan đang có phòng ban',
      );
    }

    await this.organizationRepository.remove(
      organization,
    );

    return {
      message: 'Xóa cơ quan thành công',
    };
  }
}