import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { User } from '../user/user.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';
import { Aspirant } from '../aspirant/aspirant.entity';
import { PoliticalParty } from '../political-party/political-party.entity';
import { MaterialsArrivedStatus } from './materials-arrived.enum';

@Entity('pre_election_reports')
@Index(
  'idx_pre_election_pu_office_aspirant_unique',
  ['pollingUnit', 'electoralOffice', 'aspirant'],
  {
    unique: true,
  },
)
@Index('idx_pre_election_office_aspirant', ['electoralOffice', 'aspirant'])
export class PreElectionReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ElectoralOffice, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'electoral_office_id' })
  electoralOffice!: ElectoralOffice;

  @ManyToOne(() => PollingUnit, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'polling_unit_id' })
  pollingUnit!: PollingUnit;

  @ManyToOne(() => Aspirant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'aspirant_id' })
  aspirant!: Aspirant | null;

  @ManyToOne(() => PoliticalParty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'political_party_id' })
  politicalParty!: PoliticalParty | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser!: User;

  @Column({
    type: 'enum',
    enum: MaterialsArrivedStatus,
    name: 'materials_arrived',
    default: MaterialsArrivedStatus.FULL,
  })
  materialsArrived!: MaterialsArrivedStatus;

  @Column({
    type: 'timestamp with time zone',
    name: 'material_arrival_time',
    nullable: true,
  })
  materialArrivalTime!: Date | null;

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

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments!: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'client_submitted_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  clientSubmittedAt!: Date;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'server_received_at',
  })
  serverReceivedAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
