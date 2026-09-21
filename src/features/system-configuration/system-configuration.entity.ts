import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Admin } from '../admin/admin.entity';

@Entity('system_configurations')
export class SystemConfiguration {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'is_voting_active', type: 'boolean', default: true })
  isVotingActive!: boolean;

  @Column({ name: 'allow_agent_submissions', type: 'boolean', default: true })
  allowAgentSubmissions!: boolean;

  @Column({ name: 'allow_incident_reporting', type: 'boolean', default: true })
  allowIncidentReporting!: boolean;

  @Column({ name: 'maintenance_mode', type: 'boolean', default: false })
  maintenanceMode!: boolean;

  @Column({
    name: 'submission_close_notice',
    type: 'text',
    nullable: true,
    default:
      'The voting and result collation window is currently closed. Submissions are temporarily disabled.',
  })
  submissionCloseNotice!: string | null;

  @Column({
    name: 'voting_start_time',
    type: 'timestamp with time zone',
    nullable: true,
  })
  votingStartTime!: Date | null;

  @Column({
    name: 'voting_end_time',
    type: 'timestamp with time zone',
    nullable: true,
  })
  votingEndTime!: Date | null;

  @ManyToOne(() => Admin, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_admin_id' })
  updatedByAdmin!: Admin | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
