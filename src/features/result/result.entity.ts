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

@Entity('results')
@Index(['pollingUnit', 'electoralOffice', 'uploadedByUser'], { unique: true }) // Prevents double submissions by the same agent for the same office
export class Result {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ElectoralOffice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'electoral_office_id' })
  electoralOffice!: ElectoralOffice;

  @ManyToOne(() => Aspirant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'aspirant_id' })
  aspirant!: Aspirant;

  @Column({ name: 'total_valid_votes', type: 'int', default: 0 })
  totalValidVotes!: number; // Sum of all party votes from the frontend form

  @Column({ name: 'rejected_votes', type: 'int', default: 0 })
  rejectedVotes!: number;

  @Column({ name: 'ec8a_photo_url' })
  ec8aPhotoUrl!: string; // Proof upload

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  @Column({ type: 'timestamp with time zone', name: 'client_submitted_at' })
  clientSubmittedAt!: Date;

  @ManyToOne(() => PollingUnit, (pu) => pu.results, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'polling_unit_id' })
  pollingUnit!: PollingUnit;

  @ManyToOne(() => User, (user) => user.submittedResults, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser!: User;

  @ManyToOne(() => User, (user) => user.verifiedResults, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'verified_by_user_id' })
  verifiedByUser!: User;

  // Relation to the dynamic breakdown per party
  @OneToMany(() => ResultDetail, (detail) => detail.result, { cascade: true })
  partyBreakdown!: ResultDetail[];

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'server_received_at',
  })
  serverReceivedAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
