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
@Index('idx_incidents_geolocation', ['geolocationLat', 'geolocationLng']) // Composite B-Tree index for spatial cluster & bounding box queries
@Index('idx_incidents_severity_status', ['severityLevel', 'status'])
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

  // Max 2 video evidence links
  @Column({
    type: 'jsonb',
    name: 'media_video_urls',
    default: () => "'[]'",
  })
  mediaVideoUrls!: string[];

  // Max 5 picture evidence links
  @Column({
    type: 'jsonb',
    name: 'media_picture_urls',
    default: () => "'[]'",
  })
  mediaPictureUrls!: string[];

  @Column({
    type: 'enum',
    enum: SeverityLevel,
    name: 'severity_level',
    default: SeverityLevel.MEDIUM,
  })
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
    default: null,
  })
  geolocationLat!: number | null;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    name: 'geolocation_lng',
    nullable: true,
    default: null,
  })
  geolocationLng!: number | null;

  @ManyToOne(() => User, (user) => user.reportedIncidents, {
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'reported_by_user_id' })
  reportedByUser!: User;

  @ManyToOne(() => PollingUnit, (pu) => pu.incidents, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'polling_unit_id' })
  pollingUnit!: PollingUnit | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
