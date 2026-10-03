import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const CODE_LENGTH = 5;

export const sanitizeCodeChar = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-1);

/** Keeps only alphanumerics, uppercased, truncated to the code length. */
export const sanitizeCodeString = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);

/** "a7b2c" -> ["A","7","B","2","C"] — the whole code is sanitised, not each char. */
export const toSlots = (code: string): string[] => {
  const chars = sanitizeCodeString(code).split('');
  return Array.from({ length: CODE_LENGTH }, (_, index) => chars[index] ?? '');
};

export const slotsToCode = (slots: string[]): string => slots.join('');

export const isComplete = (slots: string[]): boolean => slots.every((slot) => slot.length === 1);

interface CodeSlotsProps {
  value: string[];
  onChange: (slots: string[]) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Five single-character slots with auto-advance, backspace navigation,
 * paste support and strict alphanumeric filtering.
 */
export const CodeSlots = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  invalid = false,
  autoFocus = true,
}: CodeSlotsProps) => {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && !disabled) inputs.current[0]?.focus();
  }, [autoFocus, disabled]);

  const focusSlot = (index: number) => {
    const target = inputs.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const setSlot = (index: number, char: string) => {
    const next = [...value];
    next[index] = char;
    onChange(next);
  };

  const handleChange = (index: number, raw: string) => {
    const char = sanitizeCodeChar(raw);
    if (!char) {
      // Deleting the only character of a focused slot.
      if (raw.length === 0) setSlot(index, '');
      return;
    }
    setSlot(index, char);
    if (index < CODE_LENGTH - 1) focusSlot(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        setSlot(index, '');
      } else if (index > 0) {
        const next = [...value];
        next[index - 1] = '';
        onChange(next);
        focusSlot(index - 1);
      }
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      setSlot(index, '');
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusSlot(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusSlot(index + 1);
      return;
    }

    if (event.key === 'Enter' && isComplete(value)) {
      event.preventDefault();
      onSubmit?.();
    }
  };

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = sanitizeCodeString(event.clipboardData.getData('text'));
    if (!pasted) return;
    event.preventDefault();

    const next = [...value];
    const chars = pasted.split('');
    chars.forEach((char, offset) => {
      if (index + offset < CODE_LENGTH) next[index + offset] = char;
    });
    onChange(next);
    focusSlot(Math.min(index + chars.length, CODE_LENGTH - 1));
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Clue code">
      {value.map((char, index) => (
        <div key={index} className="relative">
          {index < CODE_LENGTH - 1 && (
            <span aria-hidden="true" className="absolute -right-1.5 top-1/2 h-px w-1.5 -translate-y-1/2 bg-white/15 sm:-right-2" />
          )}
          <motion.div
            animate={char ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 0.22 }}
            className="relative"
          >
            <input
              ref={(element) => {
                inputs.current[index] = element;
              }}
              type="text"
              inputMode="text"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={1}
              value={char}
              disabled={disabled}
              aria-label={`Code character ${index + 1}`}
              data-testid={`code-slot-${index}`}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={(event) => handlePaste(index, event)}
              onFocus={(event) => event.currentTarget.select()}
              className={`h-14 w-11 rounded-xl border bg-ink/80 text-center font-mono text-2xl font-bold uppercase text-white
                          transition-all duration-200 outline-none placeholder:text-ash/40
                          sm:h-16 sm:w-14 sm:text-3xl ${
                            invalid
                              ? 'border-crimson/70 shadow-[0_0_0_1px_rgba(255,45,85,0.4)]'
                              : char
                                ? 'border-crimson/50 shadow-glow-red'
                                : 'border-white/[0.12] focus:border-crimson/60 focus:shadow-glow-red'
                          } disabled:opacity-50`}
            />
            {char && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -bottom-4 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-ash/50"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
            )}
          </motion.div>
        </div>
      ))}
    </div>
  );
};