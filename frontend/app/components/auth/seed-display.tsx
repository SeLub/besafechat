import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Check, Copy, Download, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SeedDisplayProps {
  seed: string[];
  onConfirm: () => void;
}

export function SeedDisplay({ seed, onConfirm }: SeedDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleCopy = async () => {
    try {
      const text = seed.join(' ');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Seed phrase copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy seed phrase');
    }
  };

  const handleDownload = () => {
    const content = `Leteem - Your Identity Backup\nGenerated: ${new Date().toLocaleString()}\n\nYour 12-word seed phrase:\n${seed.map((word, i) => `${i + 1}. ${word}`).join('\n')}\n\n⚠️ IMPORTANT:\n- This is the ONLY way to recover yourSky access.\n- Stored offline = Stored safely.\n- Never share this with anyone, including Leteem staff.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leteem-seed-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black tracking-tight text-foreground mb-3">
          Your Recovery Seed
        </h2>
        <p className="text-muted-foreground font-medium px-4">
          These 12 words are the key to your Identity. Write them down in order and keep them in a
          place where only you can find them.
        </p>
      </div>

      {/* Seed Card Container */}
      <div className="relative group mb-8">
        <div
          className={`
          grid grid-cols-2 sm:grid-cols-3 gap-3 p-6 rounded-[2rem] border-2 border-primary/20 bg-card/40 backdrop-blur-xl transition-all duration-500
          ${!isVisible ? 'blur-md grayscale opacity-40 select-none' : 'blur-0 grayscale-0 opacity-100'}
        `}
        >
          {seed.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/40 shadow-sm"
            >
              <span className="text-[10px] font-black text-primary/40 w-4 uppercase tracking-tighter">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="font-mono font-bold text-foreground text-sm tracking-tight">
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* Visibility Toggle Overlay */}
        {!isVisible && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="secondary"
              onClick={() => setIsVisible(true)}
              className="rounded-full px-6 py-6 shadow-2xl bg-primary text-primary-foreground hover:scale-105 transition-transform"
            >
              <Eye className="mr-2" size={20} />
              Reveal Seed Phrase
            </Button>
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={!isVisible}
          className="flex-1 py-6 rounded-2xl border-primary/10 bg-background/40 hover:bg-primary/5 transition-all"
        >
          {copied ? (
            <Check className="mr-2 text-primary" size={18} />
          ) : (
            <Copy className="mr-2" size={18} />
          )}
          {copied ? 'Copied' : 'Copy Text'}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={!isVisible}
          className="flex-1 py-6 rounded-2xl border-primary/10 bg-background/40 hover:bg-primary/5 transition-all"
        >
          <Download className="mr-2" size={18} />
          Save as .txt
        </Button>
        <Button
          variant="ghost"
          onClick={() => setIsVisible(!isVisible)}
          className="px-4 py-6 rounded-2xl hover:bg-background/80"
        >
          {isVisible ? <EyeOff size={20} /> : <Eye size={20} />}
        </Button>
      </div>

      {/* Warning Box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-4 p-5 rounded-2xl bg-tertiary/5 border border-tertiary/20 mb-8"
      >
        <ShieldAlert className="text-tertiary shrink-0 mt-1" size={20} />
        <div className="text-sm text-tertiary/90 leading-relaxed font-medium">
          <strong>Security Protocol:</strong> This phrase never leaves your device. Leteem cannot
          recover it for you. If you lose these words, your identity is lost forever.
        </div>
      </motion.div>

      <Button
        onClick={onConfirm}
        disabled={!isVisible}
        className="w-full py-8 text-xl font-black rounded-[2rem] bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
      >
        I have secured mySky →
      </Button>
    </div>
  );
}
