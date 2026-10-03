/**
 * Input sanitisation helpers.
 *
 * `\u0000-\u001F` = C0 control characters (NUL, newlines, tabs, escape codes)
 * `\u007F`          = DEL
 * Written as escapes on purpose so the source stays copy/paste safe.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export const stripControlChars = (value: string): string => value.replace(CONTROL_CHARS, '');

export const sanitizeText = (value: string): string => stripControlChars(value).trim();

/** Strips characters that could be used for log/HTML injection. */
export const sanitizePlain = (value: string): string =>
  sanitizeText(value).replace(/[<>"'`]/g, '');