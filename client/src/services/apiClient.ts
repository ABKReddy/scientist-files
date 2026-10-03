import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiErrorPayload, AppError } from '../types';

export const NETWORK_ERROR_MESSAGE = 'Unable to connect to the server. Please try again.';
export const SESSION_EXPIRED_MESSAGE = 'Your admin session has expired. Please log in again.';

/** Fired whenever the API rejects the session so the app can bounce to /admin/login. */
export const SESSION_EXPIRED_EVENT = 'sf:session-expired';

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true, // httpOnly session cookie
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Turns any axios failure into a predictable { status, code, message } shape. */
export const toAppError = (error: unknown): AppError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorPayload>;

    if (axiosError.response) {
      const payload = axiosError.response.data;
      return {
        status: axiosError.response.status,
        code: payload?.code ?? 'REQUEST_FAILED',
        message: payload?.message ?? 'Something went wrong. Please try again.',
        errors: payload?.errors,
      };
    }

    return {
      status: 0,
      code: axiosError.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
      message:
        axiosError.code === 'ECONNABORTED'
          ? 'The request timed out. Please check your connection and try again.'
          : NETWORK_ERROR_MESSAGE,
    };
  }

  // Already normalised (e.g. an error re-thrown by a service layer): keep its message.
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Partial<AppError>;
    if (typeof candidate.message === 'string' && (candidate.code || candidate.status !== undefined)) {
      return {
        status: candidate.status ?? 0,
        code: candidate.code ?? 'UNKNOWN',
        message: candidate.message,
        errors: candidate.errors,
      };
    }
  }

  return { status: 0, code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
};

/** Performs a request and always resolves with data or throws a normalised AppError. */
export const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.request<T>(config);
    return response.data;
  } catch (error) {
    const appError = toAppError(error);
    if (appError.status === 401 && (appError.code === 'TOKEN_EXPIRED' || appError.code === 'INVALID_TOKEN')) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: appError.message }));
    }
    throw appError;
  }
};