type Level = 'info' | 'warn' | 'error' | 'debug';

const stamp = (): string => new Date().toISOString();

export const logger = {
  info(message: string, meta?: unknown): void {
    console.log(`[${stamp()}] INFO  ${message}`, meta ?? '');
  },
  warn(message: string, meta?: unknown): void {
    console.warn(`[${stamp()}] WARN  ${message}`, meta ?? '');
  },
  error(message: string, meta?: unknown): void {
    console.error(`[${stamp()}] ERROR ${message}`, meta ?? '');
  },
  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV !== 'production') console.log(`[${stamp()}] DEBUG ${message}`, meta ?? '');
  },
};

export const isLevelEnabled = (level: Level): boolean => level !== 'debug' || process.env.NODE_ENV !== 'production';