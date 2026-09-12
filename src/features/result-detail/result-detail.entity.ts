import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Result } from '../../features/result/result.entity';
import { PoliticalParty } from '../political-party/political-party.entity';

@Entity('result_details')
@Index(['result', 'politicalParty'], { unique: true }) // Blocks a single result from having two different entries for the same party
export class ResultDetail {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', default: 0 })
  votes!: number; // The actual input figure entered on the frontend for this specific party

  @ManyToOne(() => Result, (result) => result.partyBreakdown, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'result_id' })
  result!: Result;

  @ManyToOne(() => PoliticalParty, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'political_party_id' })
  politicalParty!: PoliticalParty;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
