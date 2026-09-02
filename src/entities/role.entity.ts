import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  @Index({ unique: true })
  code!: string;

  @Column()
  type!: string;

  @Column()
  description!: string;

  @Column({ default: true })
  status!: boolean;

  @OneToMany(() => User, (user: User) => user.role)
  users!: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
