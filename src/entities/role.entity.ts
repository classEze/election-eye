
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity()
export class Role {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    @Index({unique: true})
    code: string;

    @Column()
    description: string;

    @Column({ default: true })
    status: boolean;
}
