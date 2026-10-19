import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DelegateTaskDto, ReviewTaskDto, RouteTaskDto, SubmitTaskDto } from './workflow.dto';
import { TaskSecurityService, type TaskActor as Actor } from '../security/task-security.service';
@Injectable()
export class WorkflowService {
 constructor(private readonly db:DataSource, private readonly security:TaskSecurityService){}
 private org(a:Actor){if(!a?.id||!a.organizationId) throw new ForbiddenException('Missing identity / organization');return a.organizationId;}
 private async task(m:EntityManager,a:Actor,id:string){
  const rows=await m.query('SELECT * FROM public.tasks WHERE id=$1 AND organization_id=$2 FOR UPDATE',[id,this.org(a)]);
  if(!rows.length)throw new NotFoundException('Task not found');return rows[0];
 }
 private async isDeptManager(m:EntityManager,a:Actor,dept:string){
  const r=await m.query(`SELECT 1 FROM public.task_department_managers dm JOIN public.departments d ON d.id=dm.department_id
   WHERE dm.department_id=$1 AND dm.user_id=$2 AND dm.is_active=true AND d.organization_id=$3 LIMIT 1`,[dept,a.id,this.org(a)]);
  if(r.length)return true;
  if(a.departmentId!==dept)return false;
  const role=await m.query(`SELECT 1 FROM public.user_roles ur
   JOIN public.roles r ON r.id=ur.role_id
   JOIN public.users u ON u.id=ur.user_id
   WHERE ur.user_id=$1 AND r.code='LANH_DAO_PHONG' AND r.is_active=true
   AND u.department_id=$2 AND u.organization_id=$3 AND u.is_active=true AND u.is_locked=false LIMIT 1`,
  [a.id,dept,this.org(a)]);
  return !!role.length;
 }
 private async validDept(m:EntityManager,a:Actor,id:string){
  const r=await m.query('SELECT 1 FROM public.departments WHERE id=$1 AND organization_id=$2 AND is_active=true',[id,this.org(a)]);
  if(!r.length)throw new BadRequestException('Invalid department');
 }
 private async validUser(m:EntityManager,a:Actor,id:string,dept:string){
  const r=await m.query('SELECT 1 FROM public.users WHERE id=$1 AND organization_id=$2 AND department_id=$3 AND is_active=true AND is_locked=false',[id,this.org(a),dept]);
  if(!r.length)throw new BadRequestException('Assignee must be active user in target department');
 }
 private issuer(a:Actor,t:any){return a.id===t.created_by || a.id===t.assigned_by;}
 private async history(m:EntityManager,taskId:string,actorId:string,action:string,oldValue:any,newValue:any){
  await m.query('INSERT INTO public.task_history(task_id,action,performed_by,old_value,new_value,created_at) VALUES($1,$2,$3,$4,$5,NOW())',
  [taskId,action,actorId,oldValue==null?null:JSON.stringify(oldValue),newValue==null?null:JSON.stringify(newValue)]);
 }
 private async activeRoute(m:EntityManager,id:string){
  const rows=await m.query(`SELECT * FROM public.task_workflow_routes WHERE task_id=$1 AND route_status IN ('PENDING','ACCEPTED') ORDER BY issued_at DESC, id DESC LIMIT 1 FOR UPDATE`,[id]);
  return rows[0]??null;
 }
 async route(a:Actor,id:string,dto:RouteTaskDto){return this.db.transaction(async m=>{
  const t=await this.task(m,a,id);if(!this.issuer(a,t))throw new ForbiddenException('Only issuer can route');
  if(!['NEW','ASSIGNED','IN_PROGRESS'].includes(t.status))throw new BadRequestException('Task cannot be routed');
  const existing=await this.activeRoute(m,id);
  if(existing && existing.route_status==='ACCEPTED') throw new BadRequestException('Không thể thay đổi tuyến đã tiếp nhận qua API này');
  await this.validDept(m,a,dto.departmentId);
  if(dto.routeType==='DIRECT'){
   if(!dto.assigneeId)throw new BadRequestException('assigneeId required');
   await this.validUser(m,a,dto.assigneeId,dto.departmentId);
  }else if(dto.assigneeId)throw new BadRequestException('Department route must not include assigneeId');
  await m.query(`UPDATE public.task_workflow_routes SET route_status='SUPERSEDED' WHERE task_id=$1 AND route_status IN ('PENDING','ACCEPTED')`,[id]);
  await m.query('UPDATE public.task_assignments SET is_active=false WHERE task_id=$1 AND is_active=true',[id]);
  const rows=await m.query(`INSERT INTO public.task_workflow_routes(task_id,route_type,department_id,assignee_id,issued_by,note)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[id,dto.routeType,dto.departmentId,dto.assigneeId??null,a.id,dto.note??null]);
  await m.query(`UPDATE public.tasks SET department_id=$2,responsible_user_id=$3,status='ASSIGNED',updated_at=now()
   WHERE id=$1`,[id,dto.departmentId,dto.routeType==='DIRECT'?dto.assigneeId:null]);
  if(dto.routeType==='DIRECT')await m.query(`INSERT INTO public.task_assignments(task_id,user_id,assignment_type,assigned_by,assigned_at,note,is_active)
   VALUES($1,$2,'MAIN',$3,now(),$4,true)`,[id,dto.assigneeId,a.id,dto.note??null]);
  await this.history(m,id,a.id,'ROUTE',t.status,dto.routeType+':'+dto.departmentId+':'+(dto.assigneeId??''));
  return rows[0];
 });}
 async accept(a:Actor,id:string){return this.db.transaction(async m=>{
  await this.task(m,a,id);const r=await this.activeRoute(m,id);
  if(!r || r.route_status!=='PENDING')throw new BadRequestException('No pending route');
  const allowed=r.route_type==='DIRECT'?r.assignee_id===a.id:await this.isDeptManager(m,a,r.department_id);
  if(!allowed)throw new ForbiddenException('Only recipient can accept');
  await m.query(`UPDATE public.task_workflow_routes SET route_status='ACCEPTED',accepted_by=$2,accepted_at=now() WHERE id=$1`,[r.id,a.id]);
  if(r.route_type==='DIRECT')await m.query(`UPDATE public.tasks SET status='IN_PROGRESS',updated_at=now() WHERE id=$1`,[id]);
  await this.history(m,id,a.id,'ACCEPT',r.route_type,'ACCEPTED');return {accepted:true,routeId:r.id};
 });}
 async delegate(a:Actor,id:string,dto:DelegateTaskDto){return this.db.transaction(async m=>{
  const t=await this.task(m,a,id);const r=await this.activeRoute(m,id);
  if(!r || r.route_type!=='DEPARTMENT'||r.route_status!=='ACCEPTED')throw new BadRequestException('Department route must be accepted first');
  if(!(await this.isDeptManager(m,a,r.department_id)))throw new ForbiddenException('Department manager required');
  await this.validUser(m,a,dto.assigneeId,r.department_id);
  await m.query('UPDATE public.task_assignments SET is_active=false WHERE task_id=$1 AND is_active=true',[id]);
  await m.query(`INSERT INTO public.task_assignments(task_id,user_id,assignment_type,assigned_by,assigned_at,note,is_active) VALUES($1,$2,'MAIN',$3,NOW(),$4,true)`,[id,dto.assigneeId,a.id,dto.note??null]);
  await m.query(`UPDATE public.tasks SET responsible_user_id=$2,updated_at=now(),status='ASSIGNED' WHERE id=$1`,[id,dto.assigneeId]);
  await this.history(m,id,a.id,'DELEGATE',t.responsible_user_id,dto.assigneeId);
  return {taskId:id,responsibleUserId:dto.assigneeId};
 });}
 async submit(a:Actor,id:string,dto:SubmitTaskDto){return this.db.transaction(async m=>{
  const t=await this.task(m,a,id);const r=await this.activeRoute(m,id);
  if(!r||r.route_status!=='ACCEPTED'||t.responsible_user_id!==a.id)throw new ForbiddenException('Only accepted responsible user can submit');
  if(!['ASSIGNED','IN_PROGRESS'].includes(t.status))throw new BadRequestException('Invalid task status');
  await m.query(`UPDATE public.tasks SET status='PENDING_REVIEW',result=COALESCE($2,result),updated_at=now() WHERE id=$1`,[id,dto.result??null]);
  await this.history(m,id,a.id,'SUBMIT_REVIEW',t.status,'PENDING_REVIEW');return {status:'PENDING_REVIEW'};
 });}
 async review(a:Actor,id:string,dto:ReviewTaskDto){return this.db.transaction(async m=>{
  const t=await this.task(m,a,id);
  const canReview=this.issuer(a,t)
   || (t.department_id && await this.isDeptManager(m,a,t.department_id))
   || await this.security.requirePermission(a,'TASK_APPROVE').then(()=>true,()=>false);
  if(!canReview)throw new ForbiddenException('Only issuer, department manager or TASK_APPROVE holder can review');
  if(t.status!=='PENDING_REVIEW')throw new BadRequestException('Task is not pending review');
  const status=dto.decision==='APPROVE'?'COMPLETED':'IN_PROGRESS';
  await m.query(`UPDATE public.tasks SET status=$2::varchar,progress_percent=CASE WHEN $2::varchar='COMPLETED' THEN 100 ELSE progress_percent END,
  completed_at=CASE WHEN $2::varchar='COMPLETED' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1`,[id,status]);
  await this.history(m,id,a.id,'REVIEW',t.status,status+(dto.comment?': '+dto.comment:''));
  return {status,decision:dto.decision};
 });}
 async routes(a:Actor,id:string){
  const t=await this.db.query('SELECT * FROM public.tasks WHERE id=$1 AND organization_id=$2',[id,this.org(a)]);
  if(!t.length)throw new NotFoundException();
  const row=t[0];const participant=row.created_by===a.id||row.assigned_by===a.id||row.responsible_user_id===a.id;
  const assigned=await this.db.query('SELECT 1 FROM public.task_assignments WHERE task_id=$1 AND user_id=$2 AND is_active=true',[id,a.id]);
  const manager=row.department_id ? await this.isDeptManager(this.db.manager,a,row.department_id):false;
  const departmentViewer=await this.security.canViewDepartment(a,row.department_id);
  if(!participant&&!assigned.length&&!manager&&!departmentViewer)throw new ForbiddenException();
  return this.db.query('SELECT * FROM public.task_workflow_routes WHERE task_id=$1 ORDER BY issued_at DESC',[id]);
 }
 async inbox(a:Actor){
  return this.db.query(`SELECT r.*,t.title,t.due_date FROM public.task_workflow_routes r
  JOIN public.tasks t ON t.id=r.task_id
  WHERE t.organization_id=$1 AND r.route_status='PENDING' AND (
   (r.route_type='DIRECT' AND r.assignee_id=$2) OR
   (r.route_type='DEPARTMENT' AND EXISTS(SELECT 1 FROM public.task_department_managers dm
    WHERE dm.department_id=r.department_id AND dm.user_id=$2 AND dm.is_active=true)))
  ORDER BY r.issued_at DESC LIMIT 100`,[this.org(a),a.id]);
 }
}
