// /home/selub/Documents/progs/besafechat/backend/src/domains/identity/identity.entity.ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Handle } from '../handle/handle.entity';
import { Session } from '../session/session.entity';

@Entity('identities')
export class Identity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bytea', unique: true, nullable: true })
  masterPublicKey?: Buffer;

  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  publicKeyHash?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  recoveredAt?: Date | null;

  // Только базовые связи
  @OneToMany(() => Handle, (handle) => handle.ownerIdentity)
  handles!: Handle[];

  @OneToMany(() => Session, (session) => session.identity)
  sessions!: Session[];
}
