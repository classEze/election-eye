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
import { Ward } from '../ward/ward.entity';
import { Result } from '../result/result.entity';
import { Incident } from '../incident/incident.entity';
import { User } from '../user/user.entity';

@Entity('polling_units')
export class PollingUnit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true, name: 'pu_code' })
  puCode!: string;

  @Column({ name: 'registered_voters', default: 0 })
  registeredVoters!: number;

  @ManyToOne(() => Ward, (ward) => ward.pollingUnits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ward_id' })
  ward!: Ward;

  @OneToMany(() => User, (user) => user.assignedPu)
  agents!: User[];

  @OneToMany(() => Result, (result) => result.pollingUnit)
  results!: Result[];

  @OneToMany(() => Incident, (incident) => incident.pollingUnit)
  incidents!: Incident[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
