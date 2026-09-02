import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class State {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index({ unique: true })
  name!: string;

  @Column()
  @Index({ unique: true })
  code!: string;

  @Column({ name: 'geo_political_zone' })
  geoPoliticalZone!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
