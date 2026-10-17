import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

export type TaskActor = { id: string; organizationId: string; departmentId: string | null; roles: string[] };

@Injectable()
export class TaskSecurityService {
  constructor(private readonly db: DataSource) {}

  async actor(token: AuthUser): Promise<TaskActor> {
    if (!token?.sub || !token.sid || token.type !== 'access') throw new UnauthorizedException();
    // Fail closed for revoked sessions. Adjust status/expiry names if your AuthSession entity differs.
    const session = await this.db.query(`SELECT 1 FROM public.auth_sessions
      WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`, [token.sid, token.sub]);
    if (!session.length) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    const rows = await this.db.query(`SELECT id,organization_id,department_id,is_active,is_locked
      FROM public.users WHERE id=$1`, [token.sub]);
    const u=rows[0];
    if (!u || !u.is_active || u.is_locked || !u.organization_id) throw new UnauthorizedException('Tài khoản không khả dụng');
    return { id:u.id, organizationId:u.organization_id, departmentId:u.department_id, roles: token.roles ?? [] };
  }

  async requirePermission(actor: TaskActor, code: string): Promise<void> {
    // Permission is resolved from DB instead of trusting roles embedded in an access token.
    const rows=await this.db.query(`SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id=ur.role_id
      JOIN public.role_permissions rp ON rp.role_id=r.id
      JOIN public.permissions p ON p.id=rp.permission_id
      WHERE ur.user_id=$1 AND p.code=$2 AND r.is_active=true AND p.is_active=true LIMIT 1`,[actor.id,code]);
    if (!rows.length) throw new ForbiddenException(`Thiếu quyền ${code}`);
  }

  async hasAnyPermission(
    actor: TaskActor,
    codes: string[],
  ): Promise<boolean> {
    if (!codes.length) return false;

    const rows = await this.db.query(
      `
      SELECT 1
      FROM public.user_roles ur
      INNER JOIN public.roles r
        ON r.id = ur.role_id
      INNER JOIN public.role_permissions rp
        ON rp.role_id = r.id
      INNER JOIN public.permissions p
        ON p.id = rp.permission_id
      WHERE ur.user_id = $1
        AND p.code = ANY($2::text[])
        AND r.is_active = TRUE
        AND p.is_active = TRUE
      LIMIT 1
      `,
      [actor.id, codes],
    );

    return rows.length > 0;
  }

  async canViewDepartment(
    actor: TaskActor,
    departmentId: string | null,
  ): Promise<boolean> {
    if (!departmentId || actor.departmentId !== departmentId) return false;
    if (await this.hasAnyPermission(actor, ['TASK_VIEW_DEPARTMENT'])) return true;

    const roles = await this.db.query(
      `SELECT 1
      FROM public.user_roles ur
      INNER JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND r.code = 'LANH_DAO_PHONG'
        AND r.is_active = TRUE
      LIMIT 1`,
      [actor.id],
    );
    return roles.length > 0;
  }

  async requireAnyPermission(
    actor: TaskActor,
    codes: string[],
  ): Promise<void> {
    const allowed = await this.hasAnyPermission(
      actor,
      codes,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `Thiếu một trong các quyền: ${codes.join(', ')}`,
      );
    }
  }

}
