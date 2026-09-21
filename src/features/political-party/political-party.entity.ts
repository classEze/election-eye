import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
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

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl!: string | null;

  @Column({
    name: 'party_color_hex',
    type: 'varchar',
    nullable: true,
    length: 7,
  })
  partyColorHex!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => Aspirant, (aspirant) => aspirant.politicalParty)
  aspirants!: Aspirant[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({
    type: 'timestamp with time zone',
    name: 'deleted_at',
    nullable: true,
  })
  deletedAt!: Date | null;
}
