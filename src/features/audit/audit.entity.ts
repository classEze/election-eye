import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditActorType {
  ADMIN = 'ADMIN',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  ANONYMOUS = 'ANONYMOUS',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

@Entity('audit_logs')
@Index('idx_audit_actor', ['actorType', 'actorId'])
@Index('idx_audit_entity', ['entityName', 'entityId'])
@Index('idx_audit_action_date', ['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId!: number | null;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: AuditActorType,
    default: AuditActorType.ANONYMOUS,
  })
  actorType!: AuditActorType;

  @Column({ name: 'actor_email', type: 'varchar', length: 255, nullable: true })
  actorEmail!: string | null;

  @Column({ name: 'role_code', type: 'varchar', length: 50, nullable: true })
  roleCode!: string | null;

  @Column({ type: 'varchar', length: 150 })
  action!: string; // e.g. 'AUTH.LOGIN', 'RESULT.UPDATE_STATUS', 'USER.CREATE'

  @Column({ name: 'entity_name', type: 'varchar', length: 100, nullable: true })
  entityName!: string | null; // e.g. 'Result', 'User', 'Admin', 'Incident'

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId!: string | null;

  @Column({ name: 'http_method', type: 'varchar', length: 10, nullable: true })
  httpMethod!: string | null;

  @Column({ type: 'text', nullable: true })
  endpoint!: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode!: number | null;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.SUCCESS,
  })
  status!: AuditStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({
    name: 'request_payload',
    type: 'jsonb',
    nullable: true,
  })
  requestPayload!: Record<string, unknown> | null;

  @Column({
    name: 'old_state',
    type: 'jsonb',
    nullable: true,
  })
  oldState!: Record<string, unknown> | null;

  @Column({
    name: 'new_state',
    type: 'jsonb',
    nullable: true,
  })
  newState!: Record<string, unknown> | null;

  @Column({
    name: 'diff',
    type: 'jsonb',
    nullable: true,
  })
  diff!: Record<string, unknown> | null;

  @Column({
    name: 'metadata',
    type: 'jsonb',
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  @Index('idx_audit_created_at')
  createdAt!: Date;
}
