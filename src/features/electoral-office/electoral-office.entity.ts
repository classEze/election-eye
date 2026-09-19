import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { State } from '../../features/state/state.entity';
import { Lga } from '../../features/lga/lga.entity';
import { Ward } from '../../features/ward/ward.entity';
import { Aspirant } from '../aspirant/aspirant.entity';

export enum OfficeCategory {
  PRESIDENTIAL = 'PRESIDENTIAL',
  GUBERNATORIAL = 'GUBERNATORIAL',
  SENATORIAL = 'SENATORIAL',
  REPS = 'REPS',
  STATE_HOUSE = 'STATE_HOUSE',
}

@Entity('electoral_offices')
export class ElectoralOffice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'enum', enum: OfficeCategory })
  category!: OfficeCategory;

  @ManyToOne(() => State, (state) => state.electoralOffices, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'state_id' })
  state!: State;

  @ManyToMany(() => Lga, (lga) => lga.electoralOffices)
  @JoinTable({
    name: 'office_lgas',
    joinColumn: { name: 'office_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'lga_id', referencedColumnName: 'id' },
  })
  lgas!: Lga[];

  @ManyToMany(() => Ward, (ward) => ward.electoralOffices)
  @JoinTable({
    name: 'office_wards',
    joinColumn: { name: 'office_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'ward_id', referencedColumnName: 'id' },
  })
  wards!: Ward[];

  @OneToMany(() => Aspirant, (aspirant) => aspirant.electoralOffice)
  aspirants!: Aspirant[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
