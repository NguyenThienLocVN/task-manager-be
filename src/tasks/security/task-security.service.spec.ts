import { DataSource } from 'typeorm';
import { TaskSecurityService, type TaskActor } from './task-security.service';

describe('TaskSecurityService department visibility', () => {
  const actor: TaskActor = {
    id: 'user-id',
    organizationId: 'organization-id',
    departmentId: 'department-id',
    roles: ['LANH_DAO_PHONG'],
  };

  it('allows LANH_DAO_PHONG to view tasks in their own department', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }]);
    const service = new TaskSecurityService({ query } as unknown as DataSource);

    await expect(service.canViewDepartment(actor, actor.departmentId)).resolves.toBe(true);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("r.code = 'LANH_DAO_PHONG'"), [actor.id]);
  });

  it('does not grant department visibility outside the user department', async () => {
    const query = vi.fn();
    const service = new TaskSecurityService({ query } as unknown as DataSource);

    await expect(service.canViewDepartment(actor, 'another-department')).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
