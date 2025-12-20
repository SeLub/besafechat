import { db } from './db';
import type { Message } from './schema';

// Сохранение сообщения
export async function saveMessage(
  chatId: string,
  senderId: string,
  content: string,
  isOwn: boolean,
  messageId?: string
): Promise<void> {
  // Check if message with this ID already exists (prevents duplicates from multiple tabs)
  if (messageId) {
    const existing = await db.messages.where('id').equals(messageId).first();
    if (existing) {
      console.log('⚠️ Message already exists, skipping save:', messageId);
      return;
    }
  }

  const encoder = new TextEncoder();
  const encryptedContent = encoder.encode(content);
  const timestamp = Date.now();

  const message: Message = {
    id: messageId || `${senderId}_${timestamp}`,
    chatId,
    senderId,
    contentType: 'text',
    encryptedContent,
    timestamp,
    isOwn,
  };

  try {
    console.log('💾 Saving message to IndexedDB:', {
      id: message.id,
      chatId,
      senderId,
      contentLength: content.length,
    });
    await db.messages.add(message);
    console.log('✅ Message saved successfully');

    // Проверяем лимит сообщений (1000 на чат)
    await enforceMessageLimit(chatId, 1000);
  } catch (error: any) {
    if (error.name === 'ConstraintError') {
      // Message already exists (multiple tabs race condition) - this is expected
      console.log('⚠️ Message already saved by another tab');
      return;
    }
    if (error.name === 'QuotaExceededError') {
      await enforceMessageLimit(chatId, 500);
      await db.messages.add(message);
    } else {
      console.error('❌ Error saving message:', error);
      throw error;
    }
  }
}

// Ограничение количества сообщений в чате
async function enforceMessageLimit(chatId: string, limit: number): Promise<void> {
  const messages = await db.messages.where('chatId').equals(chatId).reverse().sortBy('timestamp');

  if (messages.length > limit) {
    const toDelete = messages.slice(limit).map(m => m.id);
    await db.messages.bulkDelete(toDelete);
  }
}

// Загрузка сообщений для чата
export async function loadMessages(chatId: string): Promise<
  Array<{
    id: string;
    text: string;
    isOwn: boolean;
    fromUserId: string;
  }>
> {
  const messages = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');

  const decoder = new TextDecoder();
  return messages.map(msg => ({
    id: msg.id,
    text: decoder.decode(msg.encryptedContent),
    isOwn: msg.isOwn,
    fromUserId: msg.senderId,
  }));
}

// Очистка сообщений чата
export async function clearChatMessages(chatId: string): Promise<void> {
  await db.messages.where('chatId').equals(chatId).delete();
}
