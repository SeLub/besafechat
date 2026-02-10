// /home/selub/Documents/progs/besafechat/backend/src/domains/channel/channel-subscriber.entity.ts
// Для ChannelSubscriber:
//     Меньше нагрузки на ChatMember
//     Специфичные поля для каналов (lastReadAt, isMuted)
//     Быстрый подсчет подписчиков
//     Эффективные запросы (каналы одного пользователя, подписчики канала)

import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Handle } from '../handle/handle.entity';
import { Channel } from './channel.entity';

@Entity('channel_subscribers')
export class ChannelSubscriber {
  @PrimaryColumn('uuid')
  channelId!: string;

  @PrimaryColumn('uuid')
  subscriberHandleId!: string; // Handle подписчика

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  channel!: Channel;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE' })
  subscriberHandle!: Handle;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'subscriber',
  })
  role!: string; // 'subscriber', 'moderator', 'admin'

  @Column({ type: 'boolean', default: false })
  isMuted!: boolean; // Отключены уведомления

  @CreateDateColumn({ type: 'timestamptz' })
  subscribedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt?: Date; // Время прочтения последнего сообщения

  // Индексы автоматически создаются для первичных ключей
  // Дополнительные индексы:
  // CREATE INDEX idx_channel_subscribers_handle ON channel_subscribers(subscriber_handle_id);
  // CREATE INDEX idx_channel_subscribers_channel ON channel_subscribers(channel_id, subscribed_at);
}
