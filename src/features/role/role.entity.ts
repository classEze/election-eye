import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Admin } from '../admin/admin.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  @Index('idx_roles_code_unique', { unique: true })
  code!: string;

  @Column()
  type!: string;

  @Column()
  description!: string;

  @Column({ default: true })
  status!: boolean;

  @OneToMany(() => User, (user) => user.role)
  users!: User[];

  @OneToMany(() => Admin, (admin) => admin.role)
  admins!: Admin[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
