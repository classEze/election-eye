import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { IncidentCategory } from '../../shared/entities/incident-category.entity';
import { User } from '../user/user.entity';

export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatus {
  REPORTED = 'REPORTED',
  INVESTIGATING = 'INVESTIGATING',
  CONFIRMED = 'CONFIRMED',
  RESOLVED = 'RESOLVED',
}

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => IncidentCategory, (category) => category.incidents, {
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'category_id' })
  category!: IncidentCategory;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'media_proof_url', nullable: true })
  mediaProofUrl!: string;

  @Column({ type: 'enum', enum: SeverityLevel, name: 'severity_level' })
  severityLevel!: SeverityLevel;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.REPORTED,
  })
  status!: IncidentStatus;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    name: 'geolocation_lat',
    nullable: true,
  })
  geolocationLat!: number;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    name: 'geolocation_lng',
    nullable: true,
  })
  geolocationLng!: number;

  @ManyToOne(() => User, (user) => user.reportedIncidents, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reported_by_user_id' })
  reportedByUser!: User;

  @ManyToOne(() => PollingUnit, (pu) => pu.incidents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'polling_unit_id' })
  pollingUnit!: PollingUnit;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
