import { useState } from 'react';

interface SeedDisplayProps {
  seed: string[];
  onConfirm: () => void;
}

export function SeedDisplay({ seed, onConfirm }: SeedDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(seed.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = `BeSafe Chat - Seed Phrase Backup
    
Generated: ${new Date().toLocaleString()}

Your 12-word seed phrase:
${seed.map((word, i) => `${i + 1}. ${word}`).join('\n')}

⚠️ IMPORTANT:
- Keep this safe and private
- Never share with anyone
- This is the ONLY way to recover your account
- Store in multiple secure locations

BeSafe Chat - Your privacy, your control`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `besafe-seed-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-4">Your Seed Phrase</h2>
      <p className="text-center text-muted-foreground mb-6">
        Write down these 12 words in order. You'll need them to recover your account.
      </p>

      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {seed.map((word, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="text-muted-foreground w-6">{index + 1}.</span>
              <span className="font-mono font-medium">{word}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleCopy}
          className="flex-1 py-2 border rounded-lg hover:bg-accent transition"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 py-2 border rounded-lg hover:bg-accent transition"
        >
          💾 Download
        </button>
      </div>

      <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <strong>⚠️ Warning:</strong> This is the ONLY way to recover your account if you lose
          access. Store it safely and never share with anyone.
        </p>
      </div>

      <button
        onClick={onConfirm}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition"
      >
        I Saved My Seed Phrase →
      </button>
    </div>
  );
}
