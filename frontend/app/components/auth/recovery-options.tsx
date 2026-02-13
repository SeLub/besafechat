import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// CloudDownload — отличная альтернатива, подчеркивающая загрузку из облака
import { FileText, ChevronLeft, CloudDownload, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecoveryOptionsProps {
  onPasswordRecovery: (password: string) => void;
  onSeedRecovery: (seed: string[]) => void;
}

export function RecoveryOptions({ onPasswordRecovery, onSeedRecovery }: RecoveryOptionsProps) {
  const [method, setMethod] = useState<'password' | 'seed' | null>(null);
  const [password, setPassword] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wordCount = seedInput.trim().split(/\s+/).filter(Boolean).length;

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await onPasswordRecovery(password);
    } catch (err: any) {
      setError(err.message || 'Access denied. Check your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedSubmit = async () => {
    const words = seedInput.trim().split(/\s+/);
    if (words.length !== 12) {
      setError('The phrase must contain exactly 12 words.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSeedRecovery(words);
    } catch (err: any) {
      setError(err.message || 'Invalid Seed Phrase. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = (title: string, subtitle: string) => (
    <div className="text-center mb-8">
      <h2 className="text-3xl font-black tracking-tight text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground font-medium">{subtitle}</p>
    </div>
  );

  if (!method) {
    return (
      <div className="w-full max-w-md mx-auto p-2">
        {renderHeader('Restore Access', 'Choose your path back to the Sky')}

        <div className="space-y-4">
          <button
            onClick={() => setMethod('password')}
            className="w-full group p-6 rounded-[2rem] border-2 border-primary/10 bg-card/40 backdrop-blur-xl hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-left shadow-sm"
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <CloudDownload size={24} />
              </div>
              <div>
                <div className="font-black text-lg text-foreground">Cloud Recovery</div>
                <div className="text-sm text-muted-foreground font-medium">
                  Unlock with your Master Password
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMethod('seed')}
            className="w-full group p-6 rounded-[2rem] border-2 border-primary/10 bg-card/40 backdrop-blur-xl hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-left shadow-sm"
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <div>
                <div className="font-black text-lg text-foreground">Seed Phrase</div>
                <div className="text-sm text-muted-foreground font-medium">
                  Use your 12-word recovery key
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-2">
      <button
        onClick={() => {
          setMethod(null);
          setError('');
        }}
        className="flex items-center gap-2 mb-6 text-sm font-bold text-muted-foreground/60 hover:text-primary transition-colors group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Return to selection
      </button>

      {method === 'password' ? (
        <>
          {renderHeader('Cloud Sync', 'Enter your Master Password to sync your Identity')}
          <div className="space-y-6">
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Master Password"
              className="w-full px-6 py-4 rounded-2xl border-2 border-primary/10 bg-card/40 backdrop-blur-md focus:border-primary focus:bg-background outline-none transition-all text-lg shadow-inner font-medium"
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            />
          </div>
        </>
      ) : (
        <>
          {renderHeader('Identity Seed', 'Paste or type your 12-word recovery phrase')}
          <div className="space-y-2">
            <textarea
              value={seedInput}
              onChange={e => {
                setSeedInput(e.target.value);
                setError('');
              }}
              placeholder="word1 word2 word3..."
              rows={4}
              className="w-full px-6 py-4 rounded-2xl border-2 border-primary/10 bg-card/40 backdrop-blur-md focus:border-primary focus:bg-background outline-none transition-all text-lg font-mono shadow-inner leading-relaxed resize-none"
            />
            <div className="flex justify-end px-2">
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${wordCount === 12 ? 'text-primary' : 'text-muted-foreground/40'}`}
              >
                {wordCount} / 12 Words
              </span>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 flex items-start gap-3"
          >
            <AlertCircle className="text-destructive shrink-0" size={18} />
            <p className="text-sm font-medium text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={method === 'password' ? handlePasswordSubmit : handleSeedSubmit}
        disabled={loading || (method === 'password' ? !password : wordCount < 12)}
        className="w-full mt-8 py-8 text-xl font-black rounded-[2rem] bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
      >
        {loading ? (
          'Decrypting Sky...'
        ) : (
          <span className="flex items-center gap-2">
            Enter the Sky <Send size={20} />
          </span>
        )}
      </Button>
    </div>
  );
}
