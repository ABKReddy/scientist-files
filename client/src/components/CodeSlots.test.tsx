import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CodeSlots, isComplete, sanitizeCodeChar, slotsToCode, toSlots } from './CodeSlots';

const Harness = ({ onSubmit }: { onSubmit?: (code: string) => void }) => {
  const [slots, setSlots] = useState<string[]>(() => Array.from({ length: 5 }, () => ''));
  return (
    <CodeSlots
      value={slots}
      onChange={setSlots}
      onSubmit={() => onSubmit?.(slotsToCode(slots))}
    />
  );
};

describe('code helpers', () => {
  it('keeps only the last alphanumeric character, uppercased', () => {
    expect(sanitizeCodeChar('ab')).toBe('B');
    expect(sanitizeCodeChar('7')).toBe('7');
    expect(sanitizeCodeChar('-')).toBe('');
    expect(sanitizeCodeChar('a7')).toBe('7');
  });

  it('normalises a full code into five slots', () => {
    expect(toSlots('a7b2c')).toEqual(['A', '7', 'B', '2', 'C']);
    expect(toSlots('ABC')).toEqual(['A', 'B', 'C', '', '']);
  });

  it('knows when the code is complete', () => {
    expect(isComplete(['A', 'B', 'C', 'D', 'E'])).toBe(true);
    expect(isComplete(['A', '', 'C', 'D', 'E'])).toBe(false);
  });
});

describe('<CodeSlots />', () => {
  it('renders exactly five slots', () => {
    render(<Harness />);
    for (let index = 0; index < 5; index += 1) {
      expect(screen.getByTestId(`code-slot-${index}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('code-slot-5')).not.toBeInTheDocument();
  });

  it('auto-advances and uppercases as the user types', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByTestId('code-slot-0'), 'a');
    expect(screen.getByTestId('code-slot-0')).toHaveValue('A');
    expect(screen.getByTestId('code-slot-1')).toHaveFocus();

    await user.type(screen.getByTestId('code-slot-1'), '7');
    expect(screen.getByTestId('code-slot-1')).toHaveValue('7');
    expect(screen.getByTestId('code-slot-2')).toHaveFocus();
  });

  it('ignores non-alphanumeric characters', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByTestId('code-slot-0'), '-');
    expect(screen.getByTestId('code-slot-0')).toHaveValue('');
  });

  it('moves back and clears on backspace', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByTestId('code-slot-0'), 'a');
    await user.type(screen.getByTestId('code-slot-1'), 'b');
    expect(screen.getByTestId('code-slot-1')).toHaveValue('B');
    expect(screen.getByTestId('code-slot-2')).toHaveFocus();

    // Backspace on the empty third slot clears the previous one and steps back.
    await user.keyboard('{Backspace}');
    expect(screen.getByTestId('code-slot-1')).toHaveValue('');
    expect(screen.getByTestId('code-slot-1')).toHaveFocus();

    // Backspace again clears slot 0 and returns focus to it.
    await user.keyboard('{Backspace}');
    expect(screen.getByTestId('code-slot-0')).toHaveValue('');
    expect(screen.getByTestId('code-slot-0')).toHaveFocus();
  });

  it('clears the current slot when it already holds a character', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('code-slot-0'));
    await user.type(screen.getByTestId('code-slot-0'), 'a');
    await user.click(screen.getByTestId('code-slot-0'));
    await user.keyboard('{Backspace}');

    expect(screen.getByTestId('code-slot-0')).toHaveValue('');
  });

  it('supports arrow-key navigation', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('code-slot-0'));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('code-slot-1')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('code-slot-0')).toHaveFocus();
  });

  it('fills every slot from a pasted code', () => {
    render(<Harness />);

    fireEvent.paste(screen.getByTestId('code-slot-0'), {
      clipboardData: { getData: () => '9x4k7' },
    });

    expect(screen.getByTestId('code-slot-0')).toHaveValue('9');
    expect(screen.getByTestId('code-slot-1')).toHaveValue('X');
    expect(screen.getByTestId('code-slot-2')).toHaveValue('4');
    expect(screen.getByTestId('code-slot-3')).toHaveValue('K');
    expect(screen.getByTestId('code-slot-4')).toHaveValue('7');
  });

  it('submits the assembled code when Enter is pressed on a complete code', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByTestId('code-slot-0'), 'a7b2c');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('A7B2C');
  });
});