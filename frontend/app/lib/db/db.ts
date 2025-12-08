import Dexie from "dexie";
import { SCHEMA, type Message, type Contact, type PrivateKey, type Seed } from "./schema";

class BeSafeDB extends Dexie {
  messages!: Dexie.Table<Message, string>;
  contacts!: Dexie.Table<Contact, string>;
  privateKeys!: Dexie.Table<PrivateKey, string>;
  seeds!: Dexie.Table<Seed, string>;

  constructor() {
    super("BeSafeDB");
    this.version(2).stores(SCHEMA);
  }
}

export const db = new BeSafeDB();
