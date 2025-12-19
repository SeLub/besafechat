import Dexie from "dexie";
import { SCHEMA, type Message, type Contact, type PrivateKey } from "./schema";

class BeSafeDB extends Dexie {
  messages!: Dexie.Table<Message, string>;
  contacts!: Dexie.Table<Contact, string>;
  publicKey!: Dexie.Table<PrivateKey, string>;

  constructor() {
    super("BeSafeDB");
    this.version(3).stores(SCHEMA);
  }
}

export const db = new BeSafeDB();
