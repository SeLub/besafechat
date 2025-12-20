import { db } from './db';
import type { Contact } from './schema';

// Сохранение контакта
export async function saveContact(
  id: string,
  displayName?: string,
  isPinned: boolean = false
): Promise<void> {
  const contact: Contact = {
    id,
    displayName,
    isPinned,
  };

  await db.contacts.put(contact);
}

// Загрузка всех контактов
export async function loadContacts(): Promise<Contact[]> {
  return await db.contacts.toArray();
}

// Удаление контакта
export async function deleteContact(id: string): Promise<void> {
  await db.contacts.delete(id);
}
