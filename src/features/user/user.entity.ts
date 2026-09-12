import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../role/role.entity';
import { Aspirant } from '../aspirant/aspirant.entity';
import { PasswordResets } from 'src/shared/entities/password-resets.entity';
import { UserEmailVerificationToken } from 'src/shared/entities/user-email-verification-token.entity';
import { Ward } from 'src/features/ward/ward.entity';
import { Lga } from 'src/features/lga/lga.entity';
import { PollingUnit } from 'src/features/polling-unit/polling-unit.entity';
import { Result } from 'src/features/result/result.entity';
import { Incident } from 'src/features/incident/incident.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({ unique: true, name: 'phone_number' })
  phoneNumber!: string;

  @Column({ unique: true, name: 'email_address' })
  emailAddress!: string;

  @Column({ name: 'password', select: false })
  password!: string;

  @OneToMany(() => PasswordResets, (passwordReset) => passwordReset.user)
  passwordResets!: PasswordResets[];

  @OneToMany(
    () => UserEmailVerificationToken,
    (verificationToken) => verificationToken.user,
  )
  emailVerificationTokens!: UserEmailVerificationToken[];

  @ManyToOne(() => Role, (role) => role.users, {
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'is_active', default: false })
  isActive!: boolean;

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  @Column({ name: 'force_password_reset', default: true })
  forcePasswordReset!: boolean;

  @Column({ name: 'login_count', default: 0 })
  loginCount!: number;

  @Column({
    name: 'last_login',
    nullable: true,
    type: 'timestamp with time zone',
  })
  lastLogin!: Date;

  @Column({ name: 'device_imei', nullable: true })
  deviceImei!: string;

  @Column({ name: 'fcm_token', nullable: true })
  fcmToken!: string;

  @ManyToOne(() => Aspirant, (aspirant) => aspirant.campaignTeam, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'aspirant_id' })
  aspirant!: Aspirant;

  @OneToOne(() => Aspirant, (aspirant) => aspirant.accountUser, {
    nullable: true,
  })
  aspirantAccount!: Aspirant;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'onboarded_by_user_id' })
  onboardedByUser!: User;

  @ManyToOne(() => Lga, (lga) => lga.coordinators, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'assigned_lga_id' })
  assignedLga!: Lga;

  @ManyToOne(() => Ward, (ward) => ward.coordinators, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'assigned_ward_id' })
  assignedWard!: Ward;

  @ManyToOne(() => PollingUnit, (pu) => pu.agents, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'assigned_pu_id' })
  assignedPu!: PollingUnit;

  // --- Actions & Trackers ---
  @OneToMany(() => Result, (result) => result.uploadedByUser)
  submittedResults!: Result[];

  @OneToMany(() => Result, (result) => result.verifiedByUser)
  verifiedResults!: Result[];

  @OneToMany(() => Incident, (incident) => incident.reportedByUser)
  reportedIncidents!: Incident[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
