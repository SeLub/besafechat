// app/services/s3-service.ts
import type { ApiResponse } from '~/types';
import { API_CONFIG } from './api-config';
import { handleApiResponse } from './api-utils';

export interface PresignedUrlResponse {
  presignedURL?: string;
  uploadUrl?: string;
  fileKey?: string;
}
// и мы будем использовать конкретные интерфейсы для каждого случая

export interface FileUploadOptions {
  path: string; // e.g., 'media/images', 'documents', etc.
  fileName: string;
  contentType?: string;
  fileType?: string; // Optional: 'avatar', 'image', 'video', 'audio', 'document', 'seed'
}

export class S3Service {
  private static baseUrl: string = API_CONFIG.BASE_URL;
  private static maxRetries = 3;
  private static retryDelay = 1000; // 1 секунда
  private static s3BucketUrl = 'https://s3.tebi.io/besafe.backet';

  /**
   * Ретри с экспоненциальной задержкой
   */
  private static async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${operationName} attempt ${attempt} failed:`, error);

        if (attempt === this.maxRetries) break;

        // Экспоненциальная задержка: 1s, 2s, 4s
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `${operationName} failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Загрузить любой файл
   */
  static async uploadFile(file: File | Blob, options: FileUploadOptions): Promise<void> {
    return this.withRetry(async () => {
      // Получаем presigned URL
      const response = await fetch(`${this.baseUrl}/s3/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: options.path,
          filename: options.fileName,
          contentType: options.contentType || this.detectContentType(options.fileName),
          fileType: options.fileType,
        }),
      });

      const data = await handleApiResponse<{ uploadUrl?: string; fileKey?: string }>(response);

      // Загружаем файл напрямую в S3
      const uploadUrl = data.uploadUrl;
      if (!uploadUrl) {
        throw new Error('No upload URL provided by the server');
      }
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': options.contentType || file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadResponse.statusText}`);
      }
    }, 'uploadFile');
  }

  /**
   * Получить URL для скачивания файла
   */
  static async getFileUrl(path: string, fileName: string): Promise<string> {
    return this.withRetry(async () => {
      // Правильное кодирование - каждый сегмент отдельно
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const encodedFileName = encodeURIComponent(fileName);

      console.log('getFileUrl params:', { path, fileName, encodedPath, encodedFileName });

      const response = await fetch(`${this.baseUrl}/s3/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: encodedPath,
          filename: encodedFileName,
        }),
      });

      console.log('getFileUrl response:', {
        status: response.status,
        ok: response.ok,
        url: response.url,
      });

      const data = await handleApiResponse<{ downloadUrl?: string; fileKey?: string }>(response);
      return data.downloadUrl || '';
    }, 'getFileUrl');
  }

  /**
   * Скачать файл
   */
  static async downloadFile(path: string, fileName: string): Promise<Blob> {
    return this.withRetry(async () => {
      const url = await this.getFileUrl(path, fileName);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      return await response.blob();
    }, 'downloadFile');
  }

  /**
   * Удалить файл
   */
  static async deleteFile(path: string, fileName: string): Promise<{ message: string }> {
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/s3/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: path,
          filename: fileName,
        }),
      });

      // Используем унифицированный обработчик
      const result = await handleApiResponse<{ message: string }>(response);
      return result;
    }, 'deleteFile');
  }

  /**
   * СПЕЦИАЛЬНЫЕ МЕТОДЫ ДЛЯ АВАТАРОВ
   */

  /**
   * Загрузить аватар пользователя (автоматическая конвертация в PNG 256x256)
   */
  static async uploadAvatar(userId: string, imageFile: File): Promise<string> {
    return this.withRetry(async () => {
      // 1. Конвертируем в PNG 256x256
      const pngBlob = await this.convertToPng256(imageFile);

      // 2. Загружаем через API для получения presigned URL
      const uploadResponse = await fetch(`${API_CONFIG.BASE_URL}/s3/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: '', // Empty path - backend will construct as users/{userId}/filename
          filename: 'avatar.png',
          fileType: 'avatar',
          contentType: 'image/png',
        }),
      });

      const data = await handleApiResponse<{ uploadUrl?: string; fileKey?: string }>(
        uploadResponse
      );

      // 3. Загружаем файл напрямую в S3
      const uploadUrl = data.uploadUrl;
      if (!uploadUrl) {
        throw new Error('No upload URL provided by the server');
      }
      const s3Response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: pngBlob,
      });

      if (!s3Response.ok) {
        throw new Error(`Upload failed: ${s3Response.status} - ${s3Response.statusText}`);
      }

      // 4. Возвращаем прямой URL к аватару с временным параметром для обновления кэша
      const timestamp = Date.now();
      return `${this.s3BucketUrl}/users/${userId}/avatar.png?v=${timestamp}`;
    }, 'uploadAvatar');
  }

  /**
   * Получить URL аватара пользователя
   * Возвращает null если аватара нет (будет 403)
   */
  static getAvatarUrl(userId: string): string {
    const timestamp = Date.now();
    return `${this.s3BucketUrl}/users/${userId}/avatar.png?v=${timestamp}`;
  }

  /**
   * Утилиты
   */

  /**
   * Конвертировать изображение в PNG 256x256 (без потерь)
   */
  private static async convertToPng256(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = e => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Заливаем белым фоном
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 256, 256);

          // Рассчитываем размеры для заполнения квадрата
          const scale = Math.max(256 / img.width, 256 / img.height);
          const width = img.width * scale;
          const height = img.height * scale;
          const x = (256 - width) / 2;
          const y = (256 - height) / 2;

          // Рисуем изображение
          ctx.drawImage(img, x, y, width, height);

          // Конвертируем в PNG (без потерь)
          canvas.toBlob(
            blob => (blob ? resolve(blob) : reject(new Error('Conversion failed'))),
            'image/png'
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Автоматическое определение content type
   */
  private static detectContentType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop() || '';

    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      txt: 'text/plain',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      // Office documents
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
