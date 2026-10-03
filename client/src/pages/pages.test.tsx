import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WelcomePage from './Welcome/WelcomePage';
import EnterCodePage from './EnterCode/EnterCodePage';
import ClueVideoPage from './ClueVideo/ClueVideoPage';
import AdminLoginPage from './admin/Login/AdminLoginPage';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { clueService } from '../services/clueService';
import { authService } from '../services/authService';
import { UNLOCKED_CLUE_KEY } from '../utils/unlockedClue';

const renderApp = (initialEntries: string[]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/code" element={<EnterCodePage />} />
            <Route path="/clue" element={<ClueVideoPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );

/** Fills the five slots one character at a time (mirrors real typing). */
const typeCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  for (const [index, char] of [...code].entries()) {
    // eslint-disable-next-line no-await-in-loop
    await user.type(screen.getByLabelText(`Code character ${index + 1}`), char);
  }
};

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  // Keep every test offline: the auth provider probes /api/auth/me on mount.
  vi.spyOn(authService, 'me').mockRejectedValue({
    status: 401,
    code: 'NO_TOKEN',
    message: 'Authentication required.',
  });
  vi.spyOn(clueService, 'verifyCode');
});

describe('Welcome page', () => {
  it('shows the event name, tagline and the ENTER CODE button', async () => {
    renderApp(['/']);
    expect(screen.getByText('Scientific')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Every crime reveals a clue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enter code/i })).toBeInTheDocument();
  });

  it('navigates to the code entry page', async () => {
    const user = userEvent.setup();
    renderApp(['/']);

    await user.click(screen.getByRole('button', { name: /enter code/i }));
    expect(await screen.findByText('Enter your code')).toBeInTheDocument();
  });
});

describe('Enter code page', () => {
  it('renders five slots and a GET CLUE button', () => {
    renderApp(['/code']);
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /get clue/i })).toBeInTheDocument();
  });

  it('keeps GET CLUE disabled until all five characters are entered', async () => {
    const user = userEvent.setup();
    renderApp(['/code']);

    const button = screen.getByRole('button', { name: /get clue/i });
    expect(button).toBeDisabled();

    await typeCode(user, 'a7b2');
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('Code character 5'), 'c');
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('shows the API error for an invalid code and clears the slots', async () => {
    const user = userEvent.setup();
    vi.mocked(clueService.verifyCode).mockRejectedValue({
      status: 404,
      code: 'INVALID_CODE',
      message: 'Invalid Code. No clue found.',
    });

    renderApp(['/code']);
    await typeCode(user, 'zzzzz');
    await user.click(screen.getByRole('button', { name: /get clue/i }));

    expect(await screen.findByText('Invalid Code. No clue found.')).toBeInTheDocument();
    expect(screen.getByLabelText('Code character 1')).toHaveValue('');
  });

  it('shows the unavailable message for a disabled clue', async () => {
    const user = userEvent.setup();
    vi.mocked(clueService.verifyCode).mockRejectedValue({
      status: 403,
      code: 'CLUE_UNAVAILABLE',
      message: 'This clue is currently unavailable.',
    });

    renderApp(['/code']);
    await typeCode(user, 'abcde');
    await user.click(screen.getByRole('button', { name: /get clue/i }));

    expect(await screen.findByText('This clue is currently unavailable.')).toBeInTheDocument();
  });
});

describe('Clue video page', () => {
  it('shows CLUE UNLOCKED and plays the token-gated stream URL', async () => {
    sessionStorage.setItem(
      UNLOCKED_CLUE_KEY,
      JSON.stringify({
        id: 'abc',
        title: 'Clue 01',
        description: 'Labelling room',
        videoUrl: 'https://cdn.example/raw-video.mp4',
        streamUrl: '/api/clues/abc/stream?token=xyz',
        expiresIn: 3600,
      })
    );

    renderApp(['/clue']);
    expect(await screen.findByText('Clue Unlocked')).toBeInTheDocument();
    expect(screen.getByText('Clue 01')).toBeInTheDocument();

    const video = document.querySelector('video') as HTMLVideoElement;
    // The player must use the short-lived stream endpoint, never the raw CDN URL.
    expect(video.getAttribute('src')).toBe('/api/clues/abc/stream?token=xyz');
  });
});

describe('Admin login page', () => {
  it('renders the credential fields and the LOGIN button', async () => {
    renderApp(['/admin/login']);
    expect(await screen.findByLabelText(/username \/ email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
  });

  it('keeps LOGIN disabled until both fields are filled', async () => {
    const user = userEvent.setup();
    renderApp(['/admin/login']);

    const button = screen.getByRole('button', { name: /^login$/i });
    await waitFor(() => expect(button).toBeDisabled());

    await user.type(screen.getByLabelText(/username \/ email/i), 'chief@scientificfiles.local');
    await waitFor(() => expect(button).toBeDisabled());

    await user.type(screen.getByLabelText(/^password$/i), 'Forensics#2026');
    await waitFor(() => expect(button).toBeEnabled());
  });
});