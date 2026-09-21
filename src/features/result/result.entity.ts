import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { User } from '../user/user.entity';
import { ResultDetail } from '../result-detail/result-detail.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';
import { Aspirant } from '../aspirant/aspirant.entity';

export enum ResultAuditStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FLAGGED = 'FLAGGED',
  REJECTED = 'REJECTED',
}

@Entity('results')
@Index('idx_results_pu_office_unique', ['pollingUnit', 'electoralOffice'], {
  unique: true,
}) // Prevents multiple submissions for the same office at the same PU
@Index('idx_results_office_verified', ['electoralOffice', 'isVerified'])
export class Result {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ElectoralOffice, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'electoral_office_id' })
  electoralOffice!: ElectoralOffice;

  @ManyToOne(() => Aspirant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'aspirant_id' })
  aspirant!: Aspirant | null;

  @Column({
    name: 'total_registered_voters',
    type: 'int',
    nullable: true,
    default: null,
  })
  totalRegisteredVoters!: number | null;

  @Column({
    name: 'total_accredited_voters',
    type: 'int',
    nullable: true,
    default: null,
  })
  totalAccreditedVoters!: number | null;

  @Column({ name: 'total_valid_votes', type: 'int', default: 0 })
  totalValidVotes!: number; // Sum of all party votes from the EC8A form

  @Column({ name: 'rejected_votes', type: 'int', default: 0 })
  rejectedVotes!: number;

  @Column({ name: 'ec8a_photo_url', type: 'text' })
  ec8aPhotoUrl!: string; // Media upload proof

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({
    name: 'audit_status',
    type: 'enum',
    enum: ResultAuditStatus,
    default: ResultAuditStatus.PENDING,
  })
  auditStatus!: ResultAuditStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'client_submitted_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  clientSubmittedAt!: Date;

  @ManyToOne(() => PollingUnit, (pu) => pu.results, {
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'polling_unit_id' })
  pollingUnit!: PollingUnit;

  @ManyToOne(() => User, (user) => user.submittedResults, {
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser!: User;

  @ManyToOne(() => User, (user) => user.verifiedResults, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'verified_by_user_id' })
  verifiedByUser!: User | null;

  // Relation to the dynamic breakdown per party
  @OneToMany(() => ResultDetail, (detail) => detail.result, { cascade: true })
  partyBreakdown!: ResultDetail[];

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'server_received_at',
  })
  serverReceivedAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
