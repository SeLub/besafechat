import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('usernames')
export class Username {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  username?: string;

  @OneToOne(() => User, (user) => user.username, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column({ type: 'boolean', default: false })
  isSearchable!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
