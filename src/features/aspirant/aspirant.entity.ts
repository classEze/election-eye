import { ElectoralOffice } from 'src/features/electoral-office/electoral-office.entity';
import { PoliticalParty } from 'src/features/political-party/political-party.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('aspirants')
export class Aspirant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @ManyToOne(
    () => PoliticalParty,
    (party: PoliticalParty): Aspirant[] => party.aspirants,
    {
      onDelete: 'RESTRICT',
      eager: true,
    },
  )
  @JoinColumn({ name: 'political_party_id' })
  politicalParty!: PoliticalParty;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl!: string;

  @Column({ name: 'created_by_admin_id' })
  createdByAdminId!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @ManyToOne(() => ElectoralOffice, (office) => office.aspirants, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'office_id' })
  electoralOffice!: ElectoralOffice;

  @OneToOne(() => User, (user) => user.aspirantAccount, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'account_user_id' })
  accountUser!: User;

  @OneToMany(() => User, (user) => user.aspirant)
  campaignTeam!: User[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
