import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Admin } from '../admin/admin.entity';

@Entity('admin_email_verification_tokens')
export class AdminEmailVerificationToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Admin, (admin) => admin.emailVerificationTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'admin_id' })
  admin!: Admin;

  @Column({ name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @Column({ name: 'used_at', nullable: true })
  usedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
