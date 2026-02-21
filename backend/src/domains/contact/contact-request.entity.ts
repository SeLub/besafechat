// /home/selub/Documents/progs/besafechat/backend/src/domains/contact/contact-request.entity.ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Handle } from '../handle/handle.entity';

export enum ContactRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELED = 'canceled',
}

@Entity('contact_requests')
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'fromHandleId' })
  fromHandle!: Handle;

  @Column('uuid')
  fromHandleId!: string;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'toHandleId' })
  toHandle!: Handle;

  @Column('uuid')
  toHandleId!: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ContactRequestStatus,
    default: ContactRequestStatus.PENDING,
  })
  status!: ContactRequestStatus;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
