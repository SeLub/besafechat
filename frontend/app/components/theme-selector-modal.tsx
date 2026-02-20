import { useTheme } from '~/hooks/use-theme-context';
import { Check, Palette, Sparkles, ShieldCheck, Sun } from 'lucide-react';
import { ResponsiveModal } from './ui/responsive-modal';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSelectorModal({ isOpen, onClose }: ThemeSelectorModalProps) {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      id: 'leteem' as const,
      name: 'Leteem Sky',
      description: 'The signature free-spirit blue theme',
      icon: <Sparkles className="h-5 w-5" />,
      previewColor: 'bg-[#00A3FF]',
      bgAccent: 'bg-blue-500/10',
    },
    {
      id: 'besafe' as const,
      name: 'Forest Security',
      description: 'Privacy-focused green aesthetic',
      icon: <ShieldCheck className="h-5 w-5" />,
      previewColor: 'bg-[#22C55E]',
      bgAccent: 'bg-green-500/10',
    },
    {
      id: 'minimal' as const,
      name: 'Minimal',
      description: 'Clean monochrome design',
      icon: <Sun className="h-5 w-5" />,
      previewColor: 'bg-zinc-400',
      bgAccent: 'bg-zinc-500/10',
    },
  ];

  const handleThemeSelect = (themeId: typeof theme) => {
    setTheme(themeId);
    // Даем пользователю полсекунды насладиться сменой цвета перед закрытием
    setTimeout(onClose, 200);
  };

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Appearance">
      <div className="space-y-4 pb-2">
        <div className="flex items-center space-x-2 px-2 mb-4">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">
            Select Atmosphere
          </span>
        </div>

        <div className="grid gap-3">
          {themes.map(t => {
            const isActive = theme === t.id;

            return (
              <div
                key={t.id}
                onClick={() => handleThemeSelect(t.id)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleThemeSelect(t.id)}
                role="button"
                tabIndex={0}
                className={`
                  group relative flex items-center justify-between p-5 rounded-[2rem] 
                  border-2 transition-all duration-300 outline-none
                  ${
                    isActive
                      ? 'border-primary bg-primary/[0.03] shadow-lg shadow-primary/5'
                      : 'border-primary/5 bg-primary/5 hover:border-primary/20 hover:bg-primary/[0.08]'
                  }
                `}
              >
                <div className="flex items-center space-x-4">
                  {/* Иконка с цветным кружком */}
                  <div
                    className={`
                    relative p-3 rounded-2xl transition-transform duration-500
                    ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                    ${t.bgAccent}
                  `}
                  >
                    <div
                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${t.previewColor}`}
                    />
                    <div className={isActive ? 'text-primary' : 'text-primary/40'}>{t.icon}</div>
                  </div>

                  <div>
                    <div
                      className={`font-bold text-sm transition-colors ${isActive ? 'text-foreground' : 'text-foreground/70'}`}
                    >
                      {t.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium opacity-60">
                      {t.description}
                    </div>
                  </div>
                </div>

                {/* Индикатор выбора */}
                <div
                  className={`
                  flex items-center justify-center w-6 h-6 rounded-full transition-all duration-500
                  ${isActive ? 'bg-primary scale-100' : 'bg-primary/5 scale-50 opacity-0'}
                `}
                >
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>

                {/* Эффект свечения для активной темы */}
                {isActive && (
                  <div className="absolute inset-0 rounded-[2rem] ring-1 ring-primary/20 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        <p className="px-6 py-4 text-center text-[10px] font-medium text-muted-foreground italic opacity-50">
          Themes adjust colors, blurs, and safety accents across your entire Sky experience.
        </p>
      </div>
    </ResponsiveModal>
  );
}
