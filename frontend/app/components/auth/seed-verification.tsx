import { useState } from 'react';

interface SeedVerificationProps {
  seed: string[];
  onVerified: () => void;
}

export function SeedVerification({ seed, onVerified }: SeedVerificationProps) {
  // Pick 3 random words to verify
  const [verifyIndices] = useState(() => {
    const indices: number[] = [];
    while (indices.length < 3) {
      const rand = Math.floor(Math.random() * 12);
      if (!indices.includes(rand)) indices.push(rand);
    }
    return indices.sort((a, b) => a - b);
  });

  const [inputs, setInputs] = useState<string[]>(['', '', '']);
  const [error, setError] = useState('');

  const handleVerify = () => {
    const correct = verifyIndices.every(
      (idx, i) => inputs[i].toLowerCase().trim() === seed[idx].toLowerCase()
    );

    if (correct) {
      onVerified();
    } else {
      setError('Incorrect words. Please try again.');
      setInputs(['', '', '']);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-4">Verify Seed Phrase</h2>
      <p className="text-center text-muted-foreground mb-6">
        Enter the following words to confirm you saved them correctly:
      </p>

      <div className="space-y-4 mb-6">
        {verifyIndices.map((wordIndex, i) => (
          <div key={i}>
            <label className="block text-sm font-medium mb-2">Word #{wordIndex + 1}</label>
            <input
              type="text"
              value={inputs[i]}
              onChange={e => {
                const newInputs = [...inputs];
                newInputs[i] = e.target.value;
                setInputs(newInputs);
                setError('');
              }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter word"
              autoComplete="off"
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={inputs.some(i => !i.trim())}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Verify →
      </button>
    </div>
  );
}
