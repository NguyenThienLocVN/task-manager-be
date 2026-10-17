import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { WorkflowService } from './workflow.service';
import { TaskSecurityService, type TaskActor } from '../security/task-security.service';

describe('WorkflowService department acceptance', () => {
  const actor: TaskActor = {
    id: 'manager-id',
    organizationId: 'organization-id',
    departmentId: 'department-id',
    roles: ['LANH_DAO_PHONG'],
  };
  const taskId = 'task-id';
  const task = {
    id: taskId,
    organization_id: actor.organizationId,
    created_by: 'issuer-id',
    assigned_by: 'issuer-id',
    status: 'ASSIGNED',
  };
  const pendingDepartmentRoute = {
    id: 'route-id',
    route_type: 'DEPARTMENT',
    department_id: actor.departmentId,
    route_status: 'PENDING',
  };

  function createService(roleRows: unknown[], managerRows: unknown[] = []) {
    const manager = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.tasks WHERE')) return [task];
        if (sql.includes('FROM public.task_workflow_routes')) {
          return [pendingDepartmentRoute];
        }
        if (sql.includes('FROM public.task_department_managers')) {
          return managerRows;
        }
        if (sql.includes("r.code='LANH_DAO_PHONG'")) return roleRows;
        return [];
      }),
    };
    const db = {
      transaction: vi.fn(
        async (callback: (entityManager: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
    };
    const security = {} as TaskSecurityService;

    return {
      service: new WorkflowService(
        db as unknown as DataSource,
        security,
      ),
      manager,
    };
  }

  it('allows a LANH_DAO_PHONG user to accept a route in their own department', async () => {
    const { service, manager } = createService([{ id: 1 }]);

    await expect(service.accept(actor, taskId)).resolves.toEqual({
      accepted: true,
      routeId: pendingDepartmentRoute.id,
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("r.code='LANH_DAO_PHONG'"),
      [actor.id, actor.departmentId, actor.organizationId],
    );
  });

  it('does not allow a department role to accept another department route', async () => {
    const { service, manager } = createService([]);

    await expect(
      service.accept({ ...actor, departmentId: 'another-department' }, taskId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining("r.code='LANH_DAO_PHONG'"),
      expect.anything(),
    );
  });

  it('continues to allow users explicitly mapped as task department managers', async () => {
    const { service, manager } = createService([], [{ id: 1 }]);

    await expect(service.accept(actor, taskId)).resolves.toEqual({
      accepted: true,
      routeId: pendingDepartmentRoute.id,
    });
    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining("r.code='LANH_DAO_PHONG'"),
      expect.anything(),
    );
  });
});
