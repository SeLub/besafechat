import { db } from "../db";
import { encrypt, decrypt, deriveKey } from "../encryption";

export class KeyService {
  async savePrivateKey(
    privateKey: Uint8Array,
    passphrase: string
  ): Promise<void> {
    const key = await deriveKey(passphrase);
    const data = await encrypt(privateKey, key);
    // Сохраняем как { id: 'current', data: encrypted }
    await db.publicKey.put({ id: "current", data });
  }

  async getPrivateKey(passphrase: string): Promise<Uint8Array | null> {
    const record = await db.publicKey.get("current");
    if (!record) return null;
    const key = await deriveKey(passphrase);
    // Расшифровываем record.data
    return decrypt(record.data, key);
  }
}
