import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lga } from '../lga/lga.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';

@Entity('states')
export class State {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @OneToMany(() => Lga, (lga) => lga.state)
  lgas!: Lga[];

  @OneToMany(() => ElectoralOffice, (office) => office.state)
  electoralOffices!: ElectoralOffice[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
