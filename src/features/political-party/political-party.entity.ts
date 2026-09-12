import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Aspirant } from '../aspirant/aspirant.entity';

@Entity('political_parties')
export class PoliticalParty {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  @Index('idx_political_parties_code_unique', { unique: true })
  code!: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl!: string;

  @Column({ name: 'party_color_hex', nullable: true, length: 7 })
  partyColorHex!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => Aspirant, (aspirant) => aspirant.politicalParty)
  aspirants!: Aspirant[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
