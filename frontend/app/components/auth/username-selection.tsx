import { UserService } from '@/services/user.service';
import { useEffect, useRef, useState } from 'react';

interface UsernameSelectionProps {
  onUsernameSelected: (username: string) => void;
}

export function UsernameSelection({ onUsernameSelected }: UsernameSelectionProps) {
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validateUsername = (value: string): string | null => {
    if (value.length < 5) return 'Username must be at least 5 characters';
    if (value.length > 32) return 'Username must be at most 32 characters';
    if (!/^[a-z0-9_]+$/.test(value)) return 'Only lowercase letters, numbers, and underscores';
    return null;
  };

  const checkAvailability = async (value: string) => {
    if (value.length < 5) return;

    setChecking(true);
    setError('');
    setAvailable(false);

    try {
      const isAvailable = await UserService.checkUsernameAvailable(value);

      if (isAvailable) {
        // Username is available
        setAvailable(true);
      } else {
        // Username is taken
        setError('Username is already taken');
        setAvailable(false);
      }
    } catch {
      // Network errors or other issues - assume available
      setAvailable(true);
    } finally {
      setChecking(false);
    }
  };

  const handleChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setError('');
    setAvailable(false);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Validate format first
    const validationError = validateUsername(cleaned);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check availability after 500ms delay
    if (cleaned.length >= 5) {
      debounceTimer.current = setTimeout(() => {
        checkAvailability(cleaned);
      }, 500);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleSubmit = () => {
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (error) return;
    onUsernameSelected(username);
  };

  const isValid = username.length >= 5 && available && !error && !checking;

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-4">Choose Your Username</h2>
      <p className="text-center text-muted-foreground mb-6">
        This will be your unique identifier for account recovery
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="username-input" className="block text-sm font-medium mb-2">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={e => handleChange(e.target.value)}
              placeholder="username"
              className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={32}
            />
          </div>
          {username.length > 0 && username.length < 5 && (
            <p className="text-xs text-muted-foreground mt-1">
              {username.length} / 5 characters minimum
            </p>
          )}
          {checking && (
            <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          {available && !error && !checking && (
            <p className="text-xs text-green-600 mt-1">✓ Username available</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-sm">
        <p className="font-medium mb-2">Requirements:</p>
        <ul className="space-y-1 text-muted-foreground">
          <li className={username.length >= 5 ? 'text-green-600' : ''}>
            {username.length >= 5 ? '✓' : '○'} 5-32 characters
          </li>
          <li className={/^[a-z0-9_]*$/.test(username) ? 'text-green-600' : ''}>
            {/^[a-z0-9_]*$/.test(username) ? '✓' : '○'} Lowercase letters, numbers, underscores only
          </li>
        </ul>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue →
      </button>
    </div>
  );
}
