import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CommentDto, CreateTaskDto, ProgressDto, QueryTasksDto, UpdateTaskDto } from './dto/tasks.dto';
import type { TaskActor as Actor } from './security/task-security.service';
import { TaskSecurityService } from './security/task-security.service';


const editable = new Set(['title','description','task_code','document_id','plan_id','start_date','due_date','priority','is_important','is_confidential']);
const snake = (name: string) => name.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const allowedChildTables = ['task_assignments', 'task_progress', 'task_comments', 'task_history'] as const;
@Injectable()
export class TasksService {
  constructor(
    private readonly db: DataSource,
    private readonly security: TaskSecurityService,
  ) {}
  private org(actor: Actor) {
    // Fail closed: never silently remove tenancy restrictions for missing JWT claims.
    if (!actor?.id || !actor.organizationId) throw new ForbiddenException('Missing actor organization');
    return actor.organizationId;
  }
  private async task(manager: EntityManager, actor: Actor, id: string, lock = false): Promise<any> {
    const rows = await manager.query(`SELECT * FROM public.tasks WHERE id=$1 AND organization_id=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, this.org(actor)]);
    if (!rows.length) throw new NotFoundException('Task not found in your organization');
    return rows[0];
  }
  private async canRead(m: EntityManager, actor: Actor, task: any): Promise<void> {
    if (task.organization_id !== this.org(actor)) throw new ForbiddenException();
    const assigned=await m.query('SELECT 1 FROM public.task_assignments WHERE task_id=$1 AND user_id=$2 AND is_active=true LIMIT 1',[task.id,actor.id]);
    const manager=task.department_id ? await m.query('SELECT 1 FROM public.task_department_managers WHERE department_id=$1 AND user_id=$2 AND is_active=true LIMIT 1',[task.department_id,actor.id]) : [];
    const departmentViewer = await this.security.canViewDepartment(actor, task.department_id);
    if (![task.created_by,task.assigned_by,task.responsible_user_id].includes(actor.id) && !assigned.length && !manager.length && !departmentViewer)
      throw new ForbiddenException('Bạn không tham gia công việc này');
  }
  private assertManager(actor: Actor, task: any) {
    if (actor.id !== task.created_by && actor.id !== task.assigned_by) throw new ForbiddenException('Chỉ người tạo/giao được chỉnh sửa');
  }
  async create(actor: Actor, dto: CreateTaskDto) {
    if (dto.organizationId !== this.org(actor)) throw new ForbiddenException('Cross-organization write blocked');
    if (dto.startDate && dto.dueDate && dto.startDate > dto.dueDate) throw new BadRequestException('dueDate before startDate');
    return this.db.transaction(async m => {
      if (dto.parentTaskId) {const parent=await this.task(m, actor, dto.parentTaskId);await this.canRead(m,actor,parent);}
      const rows = await m.query(`INSERT INTO public.tasks
      (task_code,title,description,document_id,plan_id,parent_task_id,organization_id,department_id,assigned_by,responsible_user_id,start_date,due_date,priority,status,progress_percent,is_important,is_confidential,created_by,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'NEW',0,$14,$15,$9,NOW(),NOW()) RETURNING *`,
      [dto.taskCode ?? null,dto.title,dto.description ?? null,dto.documentId ?? null,dto.planId ?? null,dto.parentTaskId ?? null,dto.organizationId,null,actor.id,null,dto.startDate ?? null,dto.dueDate ?? null,dto.priority ?? 3,dto.isImportant ?? false,dto.isConfidential ?? false]);
      return rows[0];
    });
  }
  async get(actor: Actor, id: string) { const t=await this.task(this.db.manager,actor,id); await this.canRead(this.db.manager,actor,t); return t; }
  private async buildFilters(actor: Actor, q: Partial<QueryTasksDto>, mine=false) {
    const params:any[]=[this.org(actor),actor.id];
    const visibility = [
      't.created_by=$2',
      't.assigned_by=$2',
      't.responsible_user_id=$2',
      'EXISTS(SELECT 1 FROM public.task_assignments a WHERE a.task_id=t.id AND a.user_id=$2 AND a.is_active=true)',
      'EXISTS(SELECT 1 FROM public.task_department_managers dm WHERE dm.department_id=t.department_id AND dm.user_id=$2 AND dm.is_active=true)',
    ];
    if (await this.security.canViewDepartment(actor, actor.departmentId)) {
      params.push(actor.departmentId);
      visibility.push(`t.department_id=$${params.length}`);
    }
    const filters=[`t.organization_id=$1`, `(${visibility.join(' OR ')})`];
    if (q.organizationId && q.organizationId!==actor.organizationId) throw new ForbiddenException();
    const add=(field:string,value:unknown)=>{params.push(value);filters.push(`${field}=$${params.length}`)};
    
    if(q.documentId) add('t.document_id',q.documentId);
    if(q.responsibleUserId) add('t.responsible_user_id',q.responsibleUserId);
    if(q.status) add('t.status',q.status);
    if(q.departmentId) add('t.department_id',q.departmentId);
    const range=(from?:string,to?:string,label='')=>{if(from&&to&&from>to) throw new BadRequestException(`${label}From must not be after ${label}To`);};
    range(q.startDateFrom,q.startDateTo,'startDate');
    range(q.dueDateFrom,q.dueDateTo,'dueDate');
    const addCmp=(field:string,op:'>='|'<=',value?:string)=>{if(!value) return;params.push(value);filters.push(`${field} ${op} $${params.length}::date`)};
    addCmp('t.start_date','>=',q.startDateFrom);
    addCmp('t.start_date','<=',q.startDateTo);
    addCmp('t.due_date','>=',q.dueDateFrom);
    addCmp('t.due_date','<=',q.dueDateTo);
    if(q.search){params.push('%'+q.search+'%');filters.push(`(t.title ILIKE $${params.length} OR t.task_code ILIKE $${params.length})`);}
    if(q.overdue==='true') filters.push(`t.due_date < CURRENT_DATE AND t.status NOT IN ('COMPLETED','CANCELLED')`);
    if(mine) filters.push(`(t.responsible_user_id=$2 OR EXISTS(SELECT 1 FROM public.task_assignments a WHERE a.task_id=t.id AND a.user_id=$2 AND a.is_active=true))`);
    return {where:filters.join(' AND '),params};
  }
  async list(actor: Actor, q: QueryTasksDto, mine=false) {
    const {where,params}=await this.buildFilters(actor,q,mine);
    const count=await this.db.query(`SELECT count(*)::int total FROM public.tasks t WHERE ${where}`,params);
    const limit=q.limit??20,page=q.page??1;
    const data=await this.db.query(`SELECT t.* FROM public.tasks t WHERE ${where} ORDER BY t.created_at DESC,t.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,(page-1)*limit]);
    return {data,meta:{total:count[0].total,page,limit,totalPages:Math.ceil(count[0].total/limit)}};
  }
  async update(actor: Actor, id: string, dto: UpdateTaskDto) {
    return this.db.transaction(async m => {
      const old=await this.task(m,actor,id,true); this.assertManager(actor,old);
      if (['COMPLETED','CANCELLED'].includes(old.status)) throw new BadRequestException('Closed task');
      const changes=Object.entries(dto).filter(([k,v]) => v!==undefined && editable.has(snake(k)));
      if (!changes.length) return old;
      const columns=changes.map(([k],i) => `${snake(k)}=$${i+2}`).join(', ');
      const rows=await m.query(`UPDATE public.tasks SET ${columns},updated_at=NOW() WHERE id=$1 RETURNING *`,[id,...changes.map(([,v])=>v)]);
      return rows[0];
    });
  }
  async delete(actor: Actor, id: string) {
    return this.db.transaction(async m => {
      const root = await this.task(m, actor, id, true);
      this.assertManager(actor, root);

      const descendants = await m.query(
        `WITH RECURSIVE task_tree(id) AS (
          SELECT id
          FROM public.tasks
          WHERE id=$1 AND organization_id=$2
          UNION
          SELECT child.id
          FROM public.tasks child
          INNER JOIN task_tree parent ON child.parent_task_id=parent.id
          WHERE child.organization_id=$2
        )
        SELECT id FROM task_tree`,
        [id, this.org(actor)],
      );
      const taskIds = descendants.map((row: { id: string }) => row.id);

      await m.query(
        'SELECT id FROM public.tasks WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [taskIds],
      );
      await m.query('DELETE FROM public.task_workflow_routes WHERE task_id=ANY($1::uuid[])', [taskIds]);
      await m.query('DELETE FROM public.task_assignments WHERE task_id=ANY($1::uuid[])', [taskIds]);
      await m.query('DELETE FROM public.task_progress WHERE task_id=ANY($1::uuid[])', [taskIds]);
      await m.query('DELETE FROM public.task_comments WHERE task_id=ANY($1::uuid[])', [taskIds]);
      await m.query('DELETE FROM public.task_history WHERE task_id=ANY($1::uuid[])', [taskIds]);
      await m.query('DELETE FROM public.tasks WHERE id=ANY($1::uuid[])', [taskIds]);

      return { deleted: true, id, deletedCount: taskIds.length };
    });
  }
  async subtasks(actor:Actor,id:string) {
    await this.get(actor,id);
    const params: unknown[] = [id, actor.organizationId, actor.id];
    let departmentScope = '';
    if (await this.security.canViewDepartment(actor, actor.departmentId)) {
      params.push(actor.departmentId);
      departmentScope = ` OR t.department_id=$${params.length}`;
    }
    return this.db.query(`SELECT t.* FROM public.tasks t WHERE t.parent_task_id=$1 AND t.organization_id=$2 AND (t.created_by=$3 OR t.assigned_by=$3 OR t.responsible_user_id=$3 OR EXISTS(SELECT 1 FROM public.task_assignments a WHERE a.task_id=t.id AND a.user_id=$3 AND a.is_active=true)${departmentScope}) ORDER BY t.created_at DESC LIMIT 100`,params);
  }
  async addProgress(actor:Actor,id:string,dto:ProgressDto) {
    return this.db.transaction(async m=>{
      const t=await this.task(m,actor,id,true); await this.canRead(m,actor,t);
      const a=await m.query('SELECT 1 FROM public.task_assignments WHERE task_id=$1 AND user_id=$2 AND is_active=true',[id,actor.id]);
      if(t.responsible_user_id!==actor.id && !a.length && actor.id!==t.created_by && actor.id!==t.assigned_by) throw new ForbiddenException('Not assigned');
      if(['COMPLETED','CANCELLED'].includes(t.status)) throw new BadRequestException('Closed task');
      const rows=await m.query(`INSERT INTO public.task_progress(task_id,user_id,progress_percent,content,difficulties,proposed_solution,created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,[id,actor.id,dto.progressPercent,dto.content??null,dto.difficulties??null,dto.proposedSolution??null]);
      await m.query('UPDATE public.tasks SET progress_percent=$2, updated_at=NOW() WHERE id=$1',[id,dto.progressPercent]);
      await m.query('INSERT INTO public.task_history(task_id,action,performed_by,old_value,new_value,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[id,'PROGRESS',actor.id,JSON.stringify(t.progress_percent),JSON.stringify(dto.progressPercent)]);
      return rows[0];
    });
  }
  async comment(actor:Actor,id:string,dto:CommentDto) {
    const t=await this.get(actor,id);
    if(dto.parentCommentId) {
      const exists=await this.db.query('SELECT 1 FROM public.task_comments WHERE id=$1 AND task_id=$2',[dto.parentCommentId,id]);
      if(!exists.length) throw new BadRequestException('Parent comment not in task');
    }
    const rows=await this.db.query('INSERT INTO public.task_comments(task_id,user_id,parent_comment_id,content,created_at) VALUES($1,$2,$3,$4,NOW()) RETURNING *',[t.id,actor.id,dto.parentCommentId??null,dto.content]);
    return rows[0];
  }
  async children(actor:Actor,id:string,table:typeof allowedChildTables[number]) {
    if(!allowedChildTables.includes(table)) throw new BadRequestException('Invalid table');
    await this.get(actor,id);
    const sort=table==='task_assignments'?'assigned_at':'created_at';
    return this.db.query(`SELECT * FROM public.${table} WHERE task_id=$1 ORDER BY ${sort} DESC LIMIT 200`,[id]);
  }
  async statistics(actor:Actor, q: Partial<QueryTasksDto> = {}) {
    const {where,params}=await this.buildFilters(actor,q);
    const rows=await this.db.query(`SELECT t.status,count(*)::int AS count FROM public.tasks t WHERE ${where} GROUP BY t.status ORDER BY t.status`,params);
    const overdue=await this.db.query(`SELECT count(*)::int AS count FROM public.tasks t WHERE ${where} AND t.due_date<CURRENT_DATE AND t.status NOT IN ('COMPLETED','CANCELLED')`,params);
    return {byStatus:rows,overdue:overdue[0].count};
  }
  async report(actor:Actor, q: Partial<QueryTasksDto> & {groupBy?: 'department'|'responsible'}) {
    const {groupBy='department',...filters}=q;
    const {where,params}=await this.buildFilters(actor,filters);
    const byDept=groupBy==='department';
    const key=byDept?'t.department_id':'t.responsible_user_id';
    const join=byDept
      ?'LEFT JOIN public.departments g ON g.id=t.department_id'
      :'LEFT JOIN public.users g ON g.id=t.responsible_user_id';
    const name=byDept?'g.name':'g.full_name';
    const data=await this.db.query(`SELECT ${key} AS "groupId", ${name} AS "groupName",
      count(*)::int AS total,
      count(*) FILTER (WHERE t.status='NEW')::int AS "new",
      count(*) FILTER (WHERE t.status='ASSIGNED')::int AS assigned,
      count(*) FILTER (WHERE t.status='IN_PROGRESS')::int AS "inProgress",
      count(*) FILTER (WHERE t.status='PENDING_REVIEW')::int AS "pendingReview",
      count(*) FILTER (WHERE t.status='COMPLETED')::int AS completed,
      count(*) FILTER (WHERE t.status='CANCELLED')::int AS cancelled,
      count(*) FILTER (WHERE t.due_date<CURRENT_DATE AND t.status NOT IN ('COMPLETED','CANCELLED'))::int AS overdue,
      COALESCE(round(avg(t.progress_percent),1),0)::float AS "avgProgress"
      FROM public.tasks t ${join} WHERE ${where}
      GROUP BY ${key}, ${name} ORDER BY total DESC, ${name} NULLS LAST`,params);
    return {groupBy,data};
  }
}
