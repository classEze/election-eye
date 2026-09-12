import { User } from 'src/features/user/user.entity';
import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

@Entity({ name: 'password-resets' })
export class PasswordResets {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.passwordResets, {
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
