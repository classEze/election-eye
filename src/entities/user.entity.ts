import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Role } from './role.entity';
import { Optional } from '@nestjs/common';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({ name: 'email_address', unique: true })
  emailAddress!: string;

  @Column({ name: 'password' })
  password!: string;

  @Optional()
  @Column({ name: 'force_password_reset', default: true })
  forcePasswordReset!: boolean;

  @Optional()
  @Column({ name: 'last_login', nullable: true })
  lastLogin?: Date;

  @Optional()
  @Column({ name: 'login_count', default: 0 })
  loginCount!: number;

  @Optional()
  @Column({ name: 'aspirant_id' })
  aspirantId!: string;

  @JoinColumn({ name: 'role_id' })
  @ManyToOne(() => Role, (role) => role.users)
  role!: Role;

  @Column({ default: true })
  status!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
