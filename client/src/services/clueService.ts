import { api, request, toAppError } from './apiClient';
import type { Clue, ListCluesResponse, UnlockedClue, UploadTicket } from '../types';

export interface UploadProgress {
  percent: number;
  loaded: number;
  total: number;
}

export const clueService = {
  /** Step 1 — stream the video to object storage, receive an upload ticket. */
  uploadVideo: (file: File, onProgress?: (progress: UploadProgress) => void) => {
    const form = new FormData();
    form.append('video', file);

    return new Promise<{ success: true; message: string; upload: UploadTicket }>((resolve, reject) => {
      api.post<{ success: true; message: string; upload: UploadTicket }>('/clues/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0, // large uploads must not be cut off by the default timeout
        onUploadProgress: (event) => {
          if (!onProgress) return;
          const total = event.total ?? file.size;
          onProgress({
            loaded: event.loaded,
            total,
            percent: total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0,
          });
        },
      })
        .then((response) => resolve(response.data))
        // Reuse the shared mapping so upload failures read exactly like every other error.
        .catch((error) => reject(toAppError(error)));
    });
  },

  /** Step 2 — the backend generates and stores the unique 5-character code. */
  createClue: (payload: { title: string; description: string; uploadToken: string }) =>
    request<{ success: true; message: string; clue: Clue }>({
      url: '/clues',
      method: 'POST',
      data: payload,
    }),

  list: (params?: { search?: string; status?: 'all' | 'active' | 'inactive' }) =>
    request<ListCluesResponse>({ url: '/clues', method: 'GET', params }),

  get: (id: string) => request<{ success: true; clue: Clue }>({ url: `/clues/${id}`, method: 'GET' }),

  setStatus: (id: string, isActive: boolean) =>
    request<{ success: true; message: string; clue: Clue }>({
      url: `/clues/${id}/status`,
      method: 'PATCH',
      data: { isActive },
    }),

  remove: (id: string) =>
    request<{ success: true; message: string; id: string }>({ url: `/clues/${id}`, method: 'DELETE' }),

  /** Public endpoint — participants only get the unlocked payload. */
  verifyCode: (code: string) =>
    request<{ success: true; message: string; clue: UnlockedClue }>({
      url: '/clues/verify',
      method: 'POST',
      data: { code },
    }),
};