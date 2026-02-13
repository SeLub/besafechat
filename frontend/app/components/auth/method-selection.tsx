import { motion } from 'framer-motion';
import { ShieldCheck, Cloud, Key, AlertTriangle } from 'lucide-react'; // Используем иконки для визуала

interface MethodSelectionProps {
  onSelectCloud: () => void;
  onSelectSelfCustody: () => void;
}

export function MethodSelection({ onSelectCloud, onSelectSelfCustody }: MethodSelectionProps) {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black tracking-tight text-foreground mb-3">
          Choose Your Security Level
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          How would you like to manage your identity keys? Choose the balance between convenience
          and absolute control.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cloud Recovery Card */}
        <motion.div
          whileHover={{ y: -5 }}
          className="group relative border border-border/50 rounded-[2rem] p-8 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-all shadow-xl shadow-black/5"
        >
          <div className="flex items-start justify-between mb-8">
            <div className="p-4 rounded-2xl bg-tertiary/10 text-tertiary">
              <Cloud size={32} />
            </div>
            <div className="text-right">
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Recommended
              </span>
              <span className="px-3 py-1 bg-tertiary/20 text-tertiary rounded-full text-xs font-bold border border-tertiary/20">
                Security: High
              </span>
            </div>
          </div>

          <h3 className="text-2xl font-bold mb-4">Cloud Recovery</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Perfect for most creators. Your keys are encrypted with your password and stored in your
            private cloud path.
          </p>

          <ul className="space-y-4 mb-10">
            <FeatureItem text="Easy login with password" />
            <FeatureItem text="Sync across all devices" />
            <FeatureItem text="Zero-knowledge encryption" />
            <FeatureItem text="Safe from device loss" warning="Requires strong recovery password" />
          </ul>

          <button
            onClick={onSelectCloud}
            className="w-full py-4 bg-foreground text-background hover:opacity-90 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-foreground/10"
          >
            Select Cloud Mode
          </button>
        </motion.div>

        {/* Self-Custody Card */}
        <motion.div
          whileHover={{ y: -5 }}
          className="group relative border border-primary/20 rounded-[2rem] p-8 bg-primary/5 backdrop-blur-md hover:bg-primary/10 transition-all shadow-xl shadow-black/5"
        >
          <div className="flex items-start justify-between mb-8">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              <Key size={32} />
            </div>
            <div className="text-right">
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Paranoid Mode
              </span>
              <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-bold border border-primary/20">
                Security: Absolute
              </span>
            </div>
          </div>

          <h3 className="text-2xl font-bold mb-4">Self-Custody</h3>
          <p className="text-sm text-muted-foreground mb-6">
            For those who trust no one. No cloud, no backups. Your keys never leave your physical
            device.
          </p>

          <ul className="space-y-4 mb-10">
            <FeatureItem text="Maximum possible privacy" />
            <FeatureItem text="No data on our servers" />
            <FeatureItem text="Full control over entropy" />
            <FeatureItem
              text="Irreversible"
              warning="Lose your seed = lose your identity"
              isDanger
            />
          </ul>

          <button
            onClick={onSelectSelfCustody}
            className="w-full py-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            Select Hardcore Mode
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureItem({
  text,
  warning,
  isDanger,
}: {
  text: string;
  warning?: string;
  isDanger?: boolean;
}) {
  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3">
        <ShieldCheck size={18} className="text-primary/60 shrink-0" />
        <span className="text-sm font-medium">{text}</span>
      </div>
      {warning && (
        <div
          className={`mt-1 ml-7 text-[11px] flex items-center gap-1 ${isDanger ? 'text-destructive' : 'text-tertiary'}`}
        >
          <AlertTriangle size={10} />
          {warning}
        </div>
      )}
    </li>
  );
}
