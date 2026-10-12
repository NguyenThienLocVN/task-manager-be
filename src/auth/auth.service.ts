import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { AuthSession } from './entities/auth-session.entity';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,

        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,

        @InjectRepository(AuthSession)
        private readonly sessionRepository: Repository<AuthSession>,

        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const username =
            dto.username.trim().toLowerCase();

        const existingUsername =
            await this.userRepository.findOne({
                where: {
                    username,
                },
            });

        if (existingUsername) {
            throw new ConflictException(
                'Tên đăng nhập đã tồn tại',
            );
        }

        if (dto.email) {
            const existingEmail =
                await this.userRepository.findOne({
                    where: {
                        email: dto.email.trim().toLowerCase(),
                    },
                });

            if (existingEmail) {
                throw new ConflictException(
                    'Email đã được sử dụng',
                );
            }
        }

        let organizationId = dto.organizationId ?? null;

        const departmentId = dto.departmentId ?? null;

        if (organizationId) {
            const organization =
                await this.organizationRepository.findOne({
                    where: {
                        id: organizationId,
                    },
                });

            if (!organization) {
                throw new BadRequestException(
                    'Cơ quan không tồn tại',
                );
            }

            if (!organization.isActive) {
                throw new BadRequestException(
                    'Cơ quan đang ngừng hoạt động',
                );
            }
        }

        if (departmentId) {
            const department =
                await this.departmentRepository.findOne({
                    where: {
                        id: departmentId,
                    },
                });

            if (!department) {
                throw new BadRequestException(
                    'Phòng ban không tồn tại',
                );
            }

            if (!department.isActive) {
                throw new BadRequestException(
                    'Phòng ban đang ngừng hoạt động',
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

            if (!organizationId) {
                organizationId = department.organizationId;
            }
        }

        const passwordHash =
            await argon2.hash(dto.password, {
                type: argon2.argon2id,
            });

        const user = this.userRepository.create({
            username,

            passwordHash,

            fullName: dto.fullName.trim(),

            email:
                dto.email?.trim().toLowerCase() ??
                null,

            phone: dto.phone?.trim() ?? null,

            organizationId,

            departmentId,

            jobTitle: dto.jobTitle?.trim() ?? null,

            avatarUrl: null,

            /*
             * If public registration is allowed, set isActive to false so that Admin can approve it.
             */
            isActive: false,

            isLocked: false,
        });

        const saved = await this.userRepository.save(user);

        return {
            id: saved.id,
            username: saved.username,
            fullName: saved.fullName,
            message:
                'Đăng ký thành công. Tài khoản đang chờ được kích hoạt.',
        };
    }

    async login(
        dto: LoginDto,
        meta: {
            ipAddress?: string;
            userAgent?: string;
        },
    ) {
        const loginIdentifier =
            dto.username.trim().toLowerCase();

        /*
         * passwordHash has select:false => addSelect.
         */
        const user =
            await this.userRepository
                .createQueryBuilder('user')
                .addSelect(
                    'user.passwordHash',
                )
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
                )
                .where(
                    '(LOWER(user.username) = :loginIdentifier OR LOWER(user.email) = :loginIdentifier)',
                    {
                        loginIdentifier,
                    },
                )
                .getOne();

        /*
         * Do not disclose whether the username exists.
         */
        if (!user) {
            throw new UnauthorizedException(
                'Tên đăng nhập hoặc mật khẩu không đúng',
            );
        }

        const passwordValid =
            await argon2.verify(
                user.passwordHash,
                dto.password,
            );

        if (!passwordValid) {
            throw new UnauthorizedException(
                'Tên đăng nhập hoặc mật khẩu không đúng',
            );
        }

        if (!user.isActive) {
            throw new UnauthorizedException(
                'Tài khoản chưa được kích hoạt hoặc đã ngừng hoạt động',
            );
        }

        if (user.isLocked) {
            throw new UnauthorizedException(
                'Tài khoản đã bị khóa',
            );
        }

        /*
         * Only get role active.
         */
        const roles =
            user.userRoles
                ?.map((item) => item.role)
                .filter((role) => role?.isActive) ??
            [];

        const roleCodes = roles.map((role) => role.code);

        const permissions =
            await this.getPermissionsForUser(
                user.id,
            );

        const sessionId = randomUUID();

        const accessToken =
            await this.signAccessToken({
                userId: user.id,
                sessionId,
                roles: roleCodes,
            });

        const refreshExpiresSeconds =
            dto.rememberMe
                ? 30 * 24 * 60 * 60
                : 7 * 24 * 60 * 60;

        const refreshToken =
            await this.signRefreshToken({
                userId: user.id,
                sessionId,
                expiresIn:
                    refreshExpiresSeconds,
            });

        const refreshTokenHash =
            await argon2.hash(
                refreshToken,
                {
                    type: argon2.argon2id,
                },
            );

        const session =
            this.sessionRepository.create({
                id: sessionId,
                userId: user.id,
                refreshTokenHash,

                deviceId: null,

                ipAddress: meta.ipAddress ?? null,

                userAgent: meta.userAgent ?? null,

                expiresAt: new Date(
                    Date.now() +
                    refreshExpiresSeconds *
                    1000,
                ),

                revokedAt: null,
            });

        await this.sessionRepository.save( session );

        await this.userRepository.update(
            user.id,
            {
                lastLoginAt: new Date(),
            },
        );

        return {
            accessToken,

            refreshToken,

            refreshExpiresSeconds,

            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                jobTitle: user.jobTitle,
                avatarUrl: user.avatarUrl,

                organization: user.organization,

                department: user.department,

                roles: roleCodes,

                permissions,
            },
        };
    }

    private async signAccessToken(payload: {
        userId: string;
        sessionId: string;
        roles: string[];
    }) {
        return this.jwtService.signAsync(
            {
                sub: payload.userId,
                sid: payload.sessionId,
                roles: payload.roles,
                type: 'access',
            },
            {
                secret: process.env.JWT_ACCESS_SECRET,
                expiresIn: '15m',
            },
        );
    }

    private async signRefreshToken(payload: {
        userId: string;
        sessionId: string;
        expiresIn: number;
    }) {
        return this.jwtService.signAsync(
            {
                sub: payload.userId,
                sid: payload.sessionId,
                type: 'refresh',
            },
            {
                secret: process.env.JWT_REFRESH_SECRET,

                expiresIn: payload.expiresIn,
            },
        );
    }

    private async getPermissionsForUser( userId: string): Promise<string[]> {
        const rows =
            await this.userRepository.manager.createQueryBuilder()
            .select(
                'DISTINCT permission.code',
                'code',
            )
            .from(
                'user_roles',
                'user_role',
            )
            .innerJoin(
                'roles',
                'role',
                'role.id = user_role.role_id',
            )
            .innerJoin(
                'role_permissions',
                'role_permission',
                'role_permission.role_id = role.id',
            )
            .innerJoin(
                'permissions',
                'permission',
                'permission.id = role_permission.permission_id',
            )
            .where(
                'user_role.user_id = :userId',
                {
                userId,
                },
            )
            .andWhere(
                'role.is_active = TRUE',
            )
            .andWhere(
                'permission.is_active = TRUE',
            )
            .orderBy(
                'permission.code',
                'ASC',
            )
            .getRawMany();

        return rows.map( (row) => row.code);
    }

    async refresh(
        refreshToken: string,
    ) {
        let payload: any;

        try {
            payload = await this.jwtService.verifyAsync(
                    refreshToken,
                    {
                        secret: process.env.JWT_REFRESH_SECRET,
                    },
                );
        } catch {
            throw new UnauthorizedException( 'Refresh token không hợp lệ' );
        }

        if ( payload.type !== 'refresh' ) {
            throw new UnauthorizedException( 'Token không hợp lệ' );
        }

        const session = await this.sessionRepository.findOne({
                where: {
                    id: payload.sid,
                    userId: payload.sub,
                },
            });

        if ( !session || session.revokedAt || session.expiresAt <= new Date()
        ) {
            throw new UnauthorizedException( 'Phiên đăng nhập đã hết hạn' );
        }

        const tokenValid =
            await argon2.verify( session.refreshTokenHash, refreshToken );

        if (!tokenValid) {
            throw new UnauthorizedException( 'Refresh token không hợp lệ' );
        }

        const user =
            await this.userRepository.findOne({
                where: { id: payload.sub },

                relations: {
                    userRoles: { role: true },
                },
            });

        if (!user || !user.isActive || user.isLocked
        ) {
            throw new UnauthorizedException( 'Tài khoản không còn khả dụng' );
        }

        const roleCodes =
            user.userRoles?.map((item) => item.role)
                .filter((role) => role?.isActive)
                .map((role) => role.code) ??
            [];

        const accessToken =
            await this.signAccessToken({
                userId: user.id,
                sessionId: session.id,
                roles: roleCodes,
            });

        return {
            accessToken,
        };
    }

    async logout(refreshToken?: string) {
        if (!refreshToken) {
            return;
        }

        try {
            const payload =
                await this.jwtService.verifyAsync(
                    refreshToken,
                    {
                        secret: process.env.JWT_REFRESH_SECRET,
                    },
                );

            await this.sessionRepository.update(
                {
                    id: payload.sid,
                    userId: payload.sub,
                },
                {
                    revokedAt: new Date(),
                },
            );
        } catch {
            // Logout vẫn coi là thành công.
        }
    }

    async getMe(userId: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },

            relations: {
                organization: true,
                department: true,
                userRoles: {
                role: true,
                },
            },
            });

        if (!user) {
            throw new UnauthorizedException('Người dùng không tồn tại');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Tài khoản đã ngừng hoạt động');
        }

        if (user.isLocked) {
            throw new UnauthorizedException('Tài khoản đã bị khóa');
        }

        const roles =
            user.userRoles
            ?.map(
                (userRole) =>
                userRole.role,
            )
            .filter(
                (role) =>
                role &&
                role.isActive,
            ) ?? [];

        const roleCodes = roles.map((role) => role.code);

        const permissions = await this.getPermissionsForUser(user.id);

        return {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,

            jobTitle: user.jobTitle,
            avatarUrl: user.avatarUrl,

            isActive: user.isActive,
            isLocked: user.isLocked,

            lastLoginAt:
            user.lastLoginAt,

            organization:
            user.organization
                ? {
                    id:
                    user.organization.id,

                    code:
                    user.organization.code,

                    name:
                    user.organization.name,
                }
                : null,

            department:
            user.department
                ? {
                    id:
                    user.department.id,

                    code:
                    user.department.code,

                    name:
                    user.department.name,

                    departmentType:
                    user.department
                        .departmentType,
                }
                : null,

            roles:
            roleCodes,

            permissions,

            createdAt:
            user.createdAt,

            updatedAt:
            user.updatedAt,
        };
    }
}
