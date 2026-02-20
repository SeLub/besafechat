import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeedVerificationProps {
  seed: string[];
  onVerified: () => void;
}

export function SeedVerification({ seed, onVerified }: SeedVerificationProps) {
  // Выбираем 3 случайных индекса для проверки
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
      setError('The words do not match your Seed Phrase. Check your notes.');
      // Не очищаем полностью, чтобы пользователь мог исправить опечатку,
      // но даем визуальный отклик
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-foreground mb-3">
          Sky Protocol Check
        </h2>
        <p className="text-muted-foreground font-medium px-4">
          To ensure your Identity can be recovered, please enter the requested words from your Seed
          Phrase.
        </p>
      </div>

      <div className="space-y-6 mb-10">
        {verifyIndices.map((wordIndex, i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <label className="block text-xs font-black uppercase tracking-widest text-primary/60 mb-2 ml-4">
              Word Number {String(wordIndex + 1).padStart(2, '0')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputs[i]}
                onChange={e => {
                  const newInputs = [...inputs];
                  newInputs[i] = e.target.value;
                  setInputs(newInputs);
                  setError('');
                }}
                className={`
                  w-full px-6 py-4 rounded-2xl border-2 bg-card/40 backdrop-blur-md transition-all text-lg font-mono
                  ${error ? 'border-destructive/50 focus:border-destructive' : 'border-primary/10 focus:border-primary focus:bg-background'}
                  outline-none shadow-sm
                `}
                placeholder="???"
                autoComplete="off"
              />
              {inputs[i].toLowerCase().trim() === seed[wordIndex].toLowerCase() && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary">
                  <ShieldCheck size={20} />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive text-sm font-medium">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4">
        <Button
          onClick={handleVerify}
          disabled={inputs.some(i => !i.trim())}
          className="w-full py-8 text-xl font-black rounded-[2rem] bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
        >
          Confirm Identity <ArrowRight className="ml-2" />
        </Button>

        <button
          onClick={() => window.location.reload()} // Или onBack, если есть
          className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground/60 hover:text-primary transition-colors"
        >
          <RefreshCw size={14} /> I need to see the Seed Phrase again
        </button>
      </div>
    </div>
  );
}
