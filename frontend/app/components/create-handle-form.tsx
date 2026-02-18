import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '@/services/api-utils';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { validators } from '@/services/validators';

interface CreateHandleFormProps {
  onSubmit: (handleName: string) => Promise<void>;
  onCancel: () => void;
}

type AvailabilityStatus = 'checking' | 'available' | 'taken' | null;

export function CreateHandleForm({ onSubmit, onCancel }: CreateHandleFormProps) {
  const [handleName, setHandleName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>(null);

  // Validate on input change
  const handleNameChange = (value: string) => {
    setHandleName(value);

    const validation = validators.handle(value);
    if (validation === true) {
      setValidationError(null);
    } else {
      setValidationError(validation);
    }
  };

  // Debounced availability check
  useEffect(() => {
    if (!handleName) {
      setAvailability(null);
      return;
    }

    // Only check availability if validation passes
    const validation = validators.handle(handleName);
    if (validation !== true) {
      setAvailability(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setAvailability('checking');
        const data = await apiRequest<{ available: boolean }>(
          API_ENDPOINTS.HANDLES.CHECK_AVAILABILITY(handleName),
          { method: 'GET' }
        );
        setAvailability(data.available ? 'available' : 'taken');
      } catch (err) {
        console.error('Failed to check availability:', err);
        setAvailability(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handleName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const validation = validators.handle(handleName);
    if (validation !== true) {
      setValidationError(validation);
      return;
    }

    if (availability !== 'available') {
      setError('Handle is not available');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(handleName);
    } catch (err: any) {
      setError(err.message || 'Failed to create handle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-bold mb-1">Handle Name</label>
        <div className="relative">
          <input
            type="text"
            value={handleName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="username"
            className="w-full rounded border border-primary/20 px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {validationError && <div className="text-red-600 text-xs mt-1">{validationError}</div>}
          {!validationError && availability && availability !== 'checking' && (
            <div
              className={`text-xs mt-1 ${
                availability === 'available' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {availability === 'available' ? '✓ Available' : '✗ Already taken'}
            </div>
          )}
          {!validationError && availability === 'checking' && (
            <div className="text-xs mt-1 text-primary/60">Checking availability...</div>
          )}
        </div>
        {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={!handleName || validationError || availability !== 'available' || isLoading}
          className="flex-1 bg-primary text-primary-foreground rounded px-4 py-2 font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {isLoading ? 'Creating...' : 'Create Handle'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded border border-primary/20 hover:bg-primary/5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
