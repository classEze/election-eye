import { User } from 'src/features/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('user_email_verification_tokens')
export class UserEmailVerificationToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.emailVerificationTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @Column({ name: 'used_at', nullable: true })
  usedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
