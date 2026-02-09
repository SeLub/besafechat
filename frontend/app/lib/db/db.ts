import Dexie from 'dexie';
import { SCHEMA, type Contact, type Message, type PublicKey } from './schema';

class BeSafeDB extends Dexie {
  messages!: Dexie.Table<Message, string>;
  contacts!: Dexie.Table<Contact, string>;
  publicKey!: Dexie.Table<PublicKey, string>;

  constructor(dbName: string = 'BeSafeDB') {
    super(dbName);
    this.version(4).stores(SCHEMA);
  }
}

// ============================================================================
// Dynamic Per-Account Database Management
// ============================================================================

let currentDb: BeSafeDB | null = null;

/**
 * Get the current database instance
 * Throws if database is not initialized - user must call initializeDb() first
 */
export function getDb(): BeSafeDB {
  if (!currentDb) {
    throw new Error(
      'Database not initialized. Call StorageService.initialize(identityId) after login.'
    );
  }
  return currentDb;
}

/**
 * Simple fallback hash function for environments without Web Crypto API
 * Used only for database naming (not encryption), so cryptographic strength not required
 * 
 * IMPORTANT: This is a graceful fallback for:
 * - Development on HTTP (non-localhost)
 * - Edge cases where crypto.subtle is unavailable
 * - Older browsers or restricted environments
 * 
 * In production (HTTPS), Web Crypto API should always be available.
 * This fallback ensures the app never crashes due to missing crypto.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate a deterministic database name from identityId
 * Uses SHA-256 hash (Web Crypto API) if available, falls back to simpleHash
 * 
 * @param identityId User's unique identity ID from server
 * @returns Promise resolving to database name (e.g., "BeSafeDB_a3f5c7e2b1d4...")
 */
async function generateDatabaseName(identityId: string): Promise<string> {
  try {
    // Try Web Crypto API (available on HTTPS and localhost)
    if (crypto.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identityId));
      const hashArray = Array.from(new Uint8Array(hash));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `BeSafeDB_${hashHex.substring(0, 16)}`;
    }
  } catch (error) {
    console.warn('Web Crypto API not available, using fallback hash:', error);
  }

  // Fallback for insecure contexts (HTTP on non-localhost IPs)
  try {
    const fallbackHash = simpleHash(identityId);
    return `BeSafeDB_${fallbackHash.substring(0, 16)}`;
  } catch (error) {
    console.error('Error generating database name:', error);
    throw new Error(
      `Failed to generate database name: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the name of a database instance
 */
function getDbName(database: BeSafeDB): string {
  return database.name;
}

/**
 * Initialize the database for a specific user account
 * Creates a unique IndexedDB database based on identityId
 * 
 * Scenarios:
 * 1. First login: Creates new database, stores reference
 * 2. Same user logs back in: Reuses existing database
 * 3. Different user logs in: Closes old database, creates new one
 * 
 * @param identityId User's identity from server (from login response)
 * @returns Promise resolving to the initialized BeSafeDB instance
 * @throws Error if database initialization fails
 */
export async function initializeDb(identityId: string): Promise<BeSafeDB> {
  try {
    // Generate deterministic database name from identityId
    const dbName = await generateDatabaseName(identityId);

    // If we have a database instance, check if it's for the same account
    if (currentDb) {
      const currentDbName = getDbName(currentDb);
      if (currentDbName === dbName) {
        // Same account, reuse the existing connection
        console.log(`Reusing existing database: ${dbName}`);
        return currentDb;
      } else {
        // Different account, close the old connection
        console.log(
          `Account switch detected. Closing old database: ${currentDbName}, opening new: ${dbName}`
        );
        await closeDb();
      }
    }

    // Create and open new database
    currentDb = new BeSafeDB(dbName);
    await currentDb.open();
    console.log(`Database initialized: ${dbName}`);
    return currentDb;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw new Error(
      `Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Close the current database connection
 * Safe to call even if no database is open
 * 
 * Use before:
 * - Logging out
 * - Switching accounts
 * - Clearing all data
 */
export async function closeDb(): Promise<void> {
  if (currentDb) {
    try {
      await currentDb.close();
      console.log('Database closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
    currentDb = null;
  }
}

/**
 * Check if a database is currently initialized
 */
export function isDbInitialized(): boolean {
  return currentDb !== null;
}
