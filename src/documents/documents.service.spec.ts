import type { Repository } from 'typeorm';
import { DocumentEntity } from './document.entity';
import { DocumentDirection } from './dto/document-direction.enum';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { DocumentsService } from './documents.service';
import type { TaskActor } from '../tasks/security/task-security.service';

describe('DocumentsService mailbox filtering', () => {
  const actor: TaskActor = {
    id: 'user-id',
    organizationId: 'organization-id',
    departmentId: 'department-id',
    roles: [],
  };

  function createService() {
    const clauses: Array<{ sql: string; parameters?: Record<string, unknown> }> = [];
    const queryBuilder = {
      andWhere: vi.fn((sql: string, parameters?: Record<string, unknown>) => {
        clauses.push({ sql, parameters });
        return queryBuilder;
      }),
      orderBy: vi.fn(() => queryBuilder),
      skip: vi.fn(() => queryBuilder),
      take: vi.fn(() => queryBuilder),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    const repo = {
      createQueryBuilder: vi.fn(() => queryBuilder),
    };
    const service = new DocumentsService(
      repo as unknown as Repository<DocumentEntity>,
      {} as Repository<never>,
    );

    return { service, clauses, queryBuilder };
  }

  it('filters the inbox by direct assignment, active department managers, and organization', async () => {
    const { service, clauses } = createService();

    await service.list(new QueryDocumentsDto(), actor, DocumentDirection.INCOMING);

    expect(clauses[0].sql).toContain('public.task_workflow_routes');
    expect(clauses[0].sql).toContain('public.task_department_managers');
    expect(clauses[0].sql).toContain("role.code = 'LANH_DAO_PHONG'");
    expect(clauses[0].sql).toContain("t.status = 'PENDING_REVIEW'");
    expect(clauses[0].sql).toContain('t.created_by = :actorId OR t.assigned_by = :actorId');
    expect(clauses[0].parameters).toEqual({
      actorId: actor.id,
      organizationId: actor.organizationId,
    });
  });

  it('filters the outbox by issuer or user who submitted the document for review', async () => {
    const { service, clauses } = createService();

    await service.list(new QueryDocumentsDto(), actor, DocumentDirection.OUTGOING);

    expect(clauses[0].sql).toContain('t.created_by = :actorId');
    expect(clauses[0].sql).toContain('t.assigned_by = :actorId');
    expect(clauses[0].sql).toContain("h.action = 'SUBMIT_REVIEW'");
    expect(clauses[0].parameters).toEqual({
      actorId: actor.id,
      organizationId: actor.organizationId,
    });
  });
});
