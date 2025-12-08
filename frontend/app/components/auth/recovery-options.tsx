import { useState } from 'react';

interface RecoveryOptionsProps {
  onPasswordRecovery: (username: string, password: string) => void;
  onSeedRecovery: (seed: string[]) => void;
}

export function RecoveryOptions({ onPasswordRecovery, onSeedRecovery }: RecoveryOptionsProps) {
  const [method, setMethod] = useState<'password' | 'seed' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordSubmit = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      await onPasswordRecovery(username, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedSubmit = async () => {
    const words = seedInput.trim().split(/\s+/);
    if (words.length !== 12) {
      setError('Please enter exactly 12 words');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSeedRecovery(words);
    } catch (err: any) {
      setError(err.message || 'Invalid seed phrase');
    } finally {
      setLoading(false);
    }
  };

  if (!method) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-2xl font-bold text-center mb-4">Restore Access</h2>
        <p className="text-center text-muted-foreground mb-6">
          Choose your recovery method:
        </p>

        <div className="space-y-3">
          <button
            onClick={() => setMethod('password')}
            className="w-full p-4 border-2 rounded-lg hover:border-primary hover:bg-accent transition text-left"
          >
            <div className="font-medium mb-1">🔑 Password (Cloud Recovery)</div>
            <div className="text-sm text-muted-foreground">
              If you saved your seed in the cloud
            </div>
          </button>

          <button
            onClick={() => setMethod('seed')}
            className="w-full p-4 border-2 rounded-lg hover:border-primary hover:bg-accent transition text-left"
          >
            <div className="font-medium mb-1">📝 Seed Phrase (12 words)</div>
            <div className="text-sm text-muted-foreground">
              Enter your 12-word seed phrase
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (method === 'password') {
    return (
      <div className="max-w-md mx-auto p-6">
        <button
          onClick={() => setMethod(null)}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold mb-4">Cloud Recovery</h2>
        <p className="text-muted-foreground mb-6">
          Enter your username and password
        </p>

        <div className="space-y-4 mb-6">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            placeholder="@username"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Password"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={handlePasswordSubmit}
          disabled={!username || !password || loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
        >
          {loading ? 'Recovering...' : 'Recover Account →'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <button
        onClick={() => setMethod(null)}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold mb-4">Enter Seed Phrase</h2>
      <p className="text-muted-foreground mb-6">
        Enter your 12-word seed phrase (separated by spaces)
      </p>

      <div className="space-y-4 mb-6">
        <textarea
          value={seedInput}
          onChange={(e) => {
            setSeedInput(e.target.value);
            setError('');
          }}
          placeholder="word1 word2 word3 ..."
          rows={4}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {seedInput.trim().split(/\s+/).filter(Boolean).length} / 12 words
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <button
        onClick={handleSeedSubmit}
        disabled={loading}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
      >
        {loading ? 'Recovering...' : 'Recover Account →'}
      </button>
    </div>
  );
}
