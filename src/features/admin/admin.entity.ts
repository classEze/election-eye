import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Role } from '../role/role.entity';
import { AdminEmailVerificationToken } from './admin-email-verification-token.entity';
import { AdminPasswordResets } from './admin-password-resets.entity';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({ unique: true, name: 'email_address' })
  emailAddress!: string;

  @Column({ name: 'password', select: false })
  password!: string;

  @Column({ unique: true, name: 'phone_number' })
  phoneNumber!: string;

  @ManyToOne(() => Role, (role) => role.admins)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @OneToMany(
    () => AdminEmailVerificationToken,
    (verificationToken) => verificationToken.admin,
  )
  emailVerificationTokens!: AdminEmailVerificationToken[];

  @OneToMany(() => AdminPasswordResets, (passwordReset) => passwordReset.admin)
  passwordResets!: AdminPasswordResets[];

  @Column({ name: 'is_active', default: true })
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

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
