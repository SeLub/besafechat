import { useState } from 'react';
import { Languages, Check, Globe2 } from 'lucide-react';
import { ResponsiveModal } from './ui/responsive-modal';
import { toast } from 'sonner';

interface LanguageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LanguageSettingsModal({ isOpen, onClose }: LanguageSettingsModalProps) {
  // В реальном приложении здесь должен быть ваш i18n hook (например, useTranslation)
  const [currentLang, setCurrentLang] = useState('en');

  const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'fr', name: 'French', native: 'Français' },
  ];

  const handleSelect = (code: string) => {
    setCurrentLang(code);
    toast.success(`Language changed to ${languages.find(l => l.code === code)?.name}`);
    // Здесь логика смены языка через i18next или другой либ
    setTimeout(onClose, 300);
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
                className={`
                  flex items-center justify-between p-5 rounded-[2rem] 
                  border transition-all duration-300 outline-none
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
