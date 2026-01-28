import { API_CONFIG } from './api-config';
import { handleApiResponse } from './api-utils';

export enum MediaType {
  AVATAR = 'avatar',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  SEED = 'seed',
  BACKUP = 'backup'
}

export class MediaService {
  private static baseUrl = API_CONFIG.BASE_URL;

  // Avatar methods
  static async uploadAvatar(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.baseUrl}/media/upload/avatar`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  static async deleteAvatar(): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/media/avatar`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Image methods
  static async uploadImage(file: File, messageId?: string): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (messageId) formData.append('messageId', messageId);
    
    const response = await fetch(`${this.baseUrl}/media/upload/image`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Video methods
  static async uploadVideo(file: File, messageId?: string): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (messageId) formData.append('messageId', messageId);
    
    const response = await fetch(`${this.baseUrl}/media/upload/video`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Document methods
  static async uploadDocument(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.baseUrl}/media/upload/document`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Audio methods
  static async uploadAudio(file: File, messageId?: string): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (messageId) formData.append('messageId', messageId);
    
    const response = await fetch(`${this.baseUrl}/media/upload/audio`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Seed methods (for cloud backup)
  static async uploadSeed(encryptedSeed: Blob, passwordHash: string): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('file', encryptedSeed);
    formData.append('passwordHash', passwordHash);
    
    const response = await fetch(`${this.baseUrl}/media/upload/seed`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Generic delete method
  static async deleteFile(type: MediaType, path: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/media/${type}/${path}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  // Utility methods
  static validateImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB
  }

  static validateDocumentFile(file: File): boolean {
    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return validTypes.includes(file.type) && file.size <= 50 * 1024 * 1024; // 50MB
  }

  static validateAudioFile(file: File): boolean {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
    return validTypes.includes(file.type) && file.size <= 20 * 1024 * 1024; // 20MB
  }

  static validateVideoFile(file: File): boolean {
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    return validTypes.includes(file.type) && file.size <= 25 * 1024 * 1024; // 25MB
  }

  static validateAvatarFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type) && file.size <= 5 * 1024 * 1024; // 5MB
  }
}