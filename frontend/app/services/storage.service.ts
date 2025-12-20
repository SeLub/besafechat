import { apiRequest } from './api-utils';
import type { EncryptedSeed } from '../lib/crypto/encryption';

export interface UploadResponse {
  success: boolean;
  path?: string;
  message?: string;
}

export interface DownloadResponse {
  success: boolean;
  data?: EncryptedSeed & { publicKey: string };
  message?: string;
}

export interface DeleteResponse {
  success: boolean;
  message?: string;
}

export interface PresignedUrlResponse {
  url: string;
  fields: Record<string, string>;
}

export class StorageService {
  /**
   * Upload encrypted seed to authenticated storage
   */
  static async uploadEncryptedSeed(encryptedSeed: EncryptedSeed): Promise<UploadResponse> {
    return apiRequest('/storage/auth/upload', {
      method: 'POST',
      body: JSON.stringify(encryptedSeed),
    });
  }

  /**
   * Download encrypted seed from authenticated storage
   */
  static async downloadEncryptedSeed(): Promise<DownloadResponse> {
    return apiRequest('/storage/auth/download');
  }

  /**
   * Download encrypted seed by username (for recovery)
   */
  static async downloadEncryptedSeedByUsername(username: string): Promise<DownloadResponse> {
    return apiRequest(`/storage/auth/download/by-username/${username}`);
  }

  /**
   * Delete encrypted seed from storage
   */
  static async deleteEncryptedSeed(): Promise<DeleteResponse> {
    return apiRequest('/storage/auth/delete', {
      method: 'DELETE',
    });
  }

  /**
   * Get presigned URL for general file upload
   */
  static async getPresignedUploadUrl(filename: string): Promise<PresignedUrlResponse> {
    return apiRequest('/storage/upload', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  }

  /**
   * Get presigned URL for file download
   */
  static async getPresignedDownloadUrl(path: string): Promise<string> {
    return apiRequest(`/storage/download/${path}`);
  }

  /**
   * Delete file from storage
   */
  static async deleteFile(path: string): Promise<DeleteResponse> {
    return apiRequest(`/storage/${path}`, {
      method: 'DELETE',
    });
  }
}
