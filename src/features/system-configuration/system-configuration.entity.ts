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

  @Column({ name: 'enable_otp', type: 'boolean', default: false })
  enableOtp!: boolean;

  @Column({ name: 'otp_validity', type: 'int', default: 300 })
  otpValidity!: number;

  @Column({ name: 'password_minimum_length', type: 'int', default: 8 })
  passwordMinimumLength!: number;

  @Column({ name: 'maximum_login_attempts', type: 'int', default: 5 })
  maximumLoginAttempts!: number;

  @Column({ name: 'maximum_upload_size', type: 'int', nullable: true })
  maximumUploadSize!: number | null;

  @Column({ name: 'maximum_files_per_submission', type: 'int', nullable: true })
  maximumFilesPerSubmission!: number | null;

  @Column({ name: 'allowed_image_format', type: 'text', nullable: true })
  allowedImageFormat!: string | null;

  @Column({ name: 'require_result_sheet', type: 'boolean', nullable: true })
  requireResultSheet!: boolean | null;

  @Column({
    name: 'require_incident_evidence',
    type: 'boolean',
    nullable: true,
  })
  requireIncidentEvidence!: boolean | null;

  @Column({ name: 'mandatory_result_fields', type: 'text', nullable: true })
  mandatoryResultFields!: string | null;

  @Column({
    name: 'mandatory_incident_fields',
    type: 'boolean',
    nullable: true,
  })
  mandatoryIncidentFields!: boolean | null;

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
