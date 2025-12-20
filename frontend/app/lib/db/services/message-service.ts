import { db } from '../db';
import type { Message } from '../schema';

export class MessageService {
  async addMessage(message: Omit<Message, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    await db.messages.add({ ...message, id });
    return id;
  }

  async getMessagesByChat(chatId: string, limit = 50): Promise<Message[]> {
    return db.messages
      .where('chatId')
      .equals(chatId)
      .reverse()
      .sortBy('timestamp')
      .then(messages => messages.slice(0, limit));
  }
}
