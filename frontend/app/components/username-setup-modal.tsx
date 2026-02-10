// app/components/username-setup-modal.tsx
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { UserService } from '@/services/user.service';
import { AtSign, CheckCircle, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface UsernameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername?: string;
  currentIsSearchable?: boolean;
  onSave: (username: string, isSearchable: boolean) => Promise<void>;
}

export function UsernameSetupModal({
  isOpen,
  onClose,
  currentUsername,
  currentIsSearchable = true,
  onSave,
}: UsernameSetupModalProps) {
  const [username, setUsername] = useState(currentUsername || '');
  const [isSearchable, setIsSearchable] = useState(currentIsSearchable);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<'unknown' | 'available' | 'taken' | 'current'>(
    'unknown'
  );
  const [valid, setValid] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Сбрасываем состояние при открытии модалки
  useEffect(() => {
    console.log('@@@@@@@@@@ UsernameSetupModal useEffect called', {
      isOpen,
      currentUsername,
      currentIsSearchable,
      username: currentUsername || '',
      isSearchable: currentIsSearchable,
    });

    if (isOpen) {
      const initialUsername = currentUsername || '';
      console.log('Setting initial state:', {
        username: initialUsername,
        isSearchable: currentIsSearchable,
      });

      setUsername(initialUsername);
      setIsSearchable(currentIsSearchable);
      setHasChanges(false);

      // Если есть текущий username, он автоматически валиден
      if (initialUsername) {
        setValid(true);
        setAvailability('current');
        console.log('Current username detected, setting availability to "current"');
      } else {
        setValid(false);
        setAvailability('unknown');
      }
    }
  }, [isOpen, currentUsername, currentIsSearchable]);

  const validateUsername = (value: string): boolean => {
    // Используем серверную валидацию: ^[a-zA-Z][a-zA-Z0-9_]{4,31}$
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
    return usernameRegex.test(value);
  };

  const handleUsernameChange = async (value: string) => {
    const lowerValue = value.toLowerCase();
    setUsername(lowerValue);

    const isValid = validateUsername(lowerValue);
    setValid(isValid);

    // Проверяем, изменился ли username
    const usernameChanged = lowerValue !== (currentUsername || '').toLowerCase();
    const searchableChanged = isSearchable !== currentIsSearchable;
    setHasChanges(usernameChanged || searchableChanged);

    if (lowerValue === (currentUsername || '').toLowerCase()) {
      // Если ввели текущий username
      setAvailability('current');
    } else if (isValid && lowerValue.length >= 5) {
      // Если валидно и не текущий - проверяем доступность
      await checkAvailability(lowerValue);
    } else {
      setAvailability('unknown');
    }
  };

  const handleSearchableChange = (checked: boolean) => {
    setIsSearchable(checked);

    // Проверяем изменения
    const usernameChanged = username !== (currentUsername || '');
    const searchableChanged = checked !== currentIsSearchable;
    setHasChanges(usernameChanged || searchableChanged);
  };

  const checkAvailability = async (usernameToCheck: string) => {
    if (!validateUsername(usernameToCheck)) {
      setAvailability('unknown');
      return;
    }

    setChecking(true);
    try {
      const isAvailable = await UserService.checkUsernameAvailable(usernameToCheck);

      if (isAvailable) {
        setAvailability('available');
      } else {
        setAvailability('taken');
      }
    } catch (error) {
      console.error('Failed to check username:', error);
      setAvailability('unknown');
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      // Если ничего не изменилось, просто закрываем
      onClose();
      return;
    }

    // Если меняется username, нужна дополнительная проверка
    if (username !== currentUsername) {
      if (availability === 'taken') {
        toast.error('This username is already taken');
        return;
      }

      if (!valid) {
        toast.error('Please enter a valid username');
        return;
      }

      if (availability === 'unknown') {
        toast.error('Please check username availability first');
        return;
      }
    }

    setLoading(true);
    try {
      await onSave(username, isSearchable);
      onClose();
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isSaveButtonDisabled =
    loading ||
    (username && !valid) ||
    availability === 'taken' ||
    (username !== currentUsername && availability === 'unknown');

  const saveButtonText = hasChanges ? (loading ? 'Saving...' : 'Save') : 'Close';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {currentUsername ? 'Edit Username' : 'Set Username'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="username-input" className="text-sm font-medium mb-2 block">
              Username
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="username-input"
                type="text"
                placeholder="username"
                value={username}
                onChange={e => handleUsernameChange(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20 ${
                  availability === 'taken'
                    ? 'border border-destructive'
                    : availability === 'current'
                      ? 'border border-green-500'
                      : ''
                }`}
                maxLength={32}
                disabled={loading}
              />
            </div>

            {/* Статус валидации */}
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground">
                5-32 characters, start with a letter, and contain only letters, numbers, or
                underscores
              </div>

              {username && (
                <div className="flex items-center gap-2">
                  {!valid && username.length > 0 && (
                    <>
                      <XCircle className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-destructive">Invalid username format</span>
                    </>
                  )}

                  {valid && availability === 'unknown' && username !== currentUsername && (
                    <>
                      <div className="h-3 w-3 rounded-full bg-yellow-500" />
                      <span className="text-xs text-yellow-600">
                        {checking ? 'Checking...' : 'Check availability'}
                      </span>
                    </>
                  )}

                  {valid && availability === 'available' && (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">Username is available!</span>
                    </>
                  )}

                  {valid && availability === 'current' && (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">Your current username</span>
                    </>
                  )}

                  {valid && availability === 'taken' && (
                    <>
                      <XCircle className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-destructive">Username is already taken</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Allow others to find me</div>
              <div className="text-sm text-muted-foreground">
                Let others search for you by username
              </div>
            </div>
            <Switch
              checked={isSearchable}
              onCheckedChange={handleSearchableChange}
              disabled={loading}
            />
          </div>

          {/* Отображение текущего состояния */}
          {currentIsSearchable !== undefined && (
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              Current setting:{' '}
              {currentIsSearchable ? 'Searchable by others' : 'Not searchable by others'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaveButtonDisabled}
            variant={hasChanges ? 'default' : 'outline'}
          >
            {saveButtonText}
          </Button>
        </div>
      </div>
    </>
  );
}
