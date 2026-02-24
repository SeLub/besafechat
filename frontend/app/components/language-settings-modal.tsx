import { useState } from 'react';
import { Check, Globe2 } from 'lucide-react';
import { ResponsiveModal } from './ui/responsive-modal';
import { toast } from 'sonner';
import { useProfileSettings, type Language } from '@/hooks/use-profile-settings';

interface LanguageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LanguageSettingsModal({ isOpen, onClose }: LanguageSettingsModalProps) {
  const { settings, updateSettings } = useProfileSettings();
  const [currentLang, setCurrentLang] = useState<Language>(settings.ui.language);
  const [loading, setLoading] = useState(false);

  const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'fr', name: 'French', native: 'Français' },
  ] as const;

  const handleSelect = async (code: string) => {
    const langCode = code as Language;
    setCurrentLang(langCode);
    setLoading(true);

    try {
      await updateSettings({
        ui: {
          theme: settings.ui.theme,
          language: langCode,
        },
      });

      const langName = languages.find((l) => l.code === code)?.name;
      toast.success(`Language changed to ${langName}`);
      setTimeout(onClose, 300);
    } catch (error) {
      toast.error('Failed to update language');
      // Revert on error
      setCurrentLang(settings.ui.language);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Language">
      <div className="space-y-6 pb-2">
        <div className="flex items-center space-x-3 p-4 rounded-[1.5rem] bg-primary/5 border border-primary/10">
          <div className="p-2 bg-background rounded-xl text-primary shadow-sm">
            <Globe2 size={18} />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
            Select your preferred language for the interface and system notifications.
          </p>
        </div>

        <div className="grid gap-2">
          {languages.map(lang => {
            const isActive = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                disabled={loading}
                className={`
                  flex items-center justify-between p-5 rounded-[2rem] 
                  border transition-all duration-300 outline-none disabled:opacity-50
                  ${
                    isActive
                      ? 'border-primary bg-primary/[0.03] translate-x-1'
                      : 'border-transparent bg-primary/5 hover:bg-primary/10'
                  }
                `}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-primary' : 'text-muted-foreground/50'}`}
                  >
                    {lang.code}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{lang.name}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      {lang.native}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div className="bg-primary p-1 rounded-full text-white animate-in zoom-in duration-300">
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </ResponsiveModal>
  );
}
