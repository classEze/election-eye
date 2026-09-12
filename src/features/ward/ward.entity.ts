import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lga } from '../lga/lga.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { User } from 'src/features/user/user.entity';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true, name: 'ward_code' })
  wardCode!: string;

  @ManyToOne(() => Lga, (lga) => lga.wards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lga_id' })
  lga!: Lga;

  @OneToMany(() => PollingUnit, (pu) => pu.ward)
  pollingUnits!: PollingUnit[];

  @OneToMany(() => User, (user) => user.assignedWard)
  coordinators!: User[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
