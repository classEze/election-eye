import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { State } from '../state/state.entity';
import { Ward } from '../ward/ward.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';
import { User } from '../user/user.entity';

@Entity('lgas')
export class Lga {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true, name: 'lga_code' })
  lgaCode!: string;

  @ManyToOne(() => State, (state) => state.lgas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'state_id' })
  state!: State;

  @OneToMany(() => Ward, (ward) => ward.lga)
  wards!: Ward[];

  @ManyToMany(() => ElectoralOffice, (office) => office.lgas)
  electoralOffices!: ElectoralOffice[];

  @OneToMany(() => User, (user) => user.assignedLga)
  coordinators!: User[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
