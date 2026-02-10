export interface LoginCredentials {
  publicKey: string;
  privateKey?: Uint8Array; // Optional: provided during account creation/recovery
  deviceId?: string;
  deviceName?: string;
}
