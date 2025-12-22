import { API_CONFIG } from './api-config';

/**
 * Generic API response handler
 */
import type { ApiResponse } from '~/types';

/**
 * Unified API response handler for ApiResponse<T> format
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  console.log('API Response:', {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  // Сначала читаем текст ответа
  const responseText = await response.text().catch(() => 'Failed to read response');

  let apiResponse: ApiResponse<any>;

  try {
    // Пытаемся распарсить JSON
    apiResponse = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    console.error('Failed to parse JSON:', { responseText, error });
    apiResponse = {
      success: false,
      error: 'Invalid JSON response from server',
    };
  }

  console.log('Parsed ApiResponse:', apiResponse);

  // Если HTTP статус не успешный ИЛИ success === false в теле ответа
  if (!response.ok || !apiResponse.success) {
    const errorMessage =
      apiResponse.error || response.statusText || `HTTP error! status: ${response.status}`;

    console.error('API Error:', {
      status: response.status,
      success: apiResponse.success,
      error: apiResponse.error,
      message: errorMessage,
      url: response.url,
    });

    const error = new Error(errorMessage);
    (error as any).status = response.status; // Сохраняем статус код
    (error as any).data = apiResponse; // Сохраняем полный ответ
    throw error;
  }

  // Возвращаем data, но проверяем что она существует
  if (apiResponse.data === undefined) {
    console.warn('ApiResponse.data is undefined for successful request');
  }

  return apiResponse.data as T;
}

/**
 * Generic API request function
 */
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  const res = await fetch(url, mergedOptions);
  return handleApiResponse<T>(res);
}
