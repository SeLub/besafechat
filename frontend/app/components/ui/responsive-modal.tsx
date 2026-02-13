import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul'; // Убедись, что установил: npm install vaul
import { useMediaQuery } from '~/hooks/use-media-query';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function ResponsiveModal({ isOpen, onClose, title, children }: ResponsiveModalProps) {
  const { isMobile } = useMediaQuery();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  // --- МОБИЛЬНАЯ ВЕРСИЯ (Drawer/BottomSheet) ---
  if (isMobile) {
    return createPortal(
      <Drawer.Root open={isOpen} onOpenChange={open => !open && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]" />
          <Drawer.Content className="bg-card fixed bottom-0 left-0 right-0 z-[1001] flex flex-col rounded-t-[2.5rem] border-t border-primary/10 outline-none">
            {/* Декоративная полоска для свайпа */}
            <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-primary/20" />

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black italic tracking-tight">{title}</h2>
                <button onClick={onClose} className="p-2 rounded-full bg-primary/5">
                  <X size={18} />
                </button>
              </div>
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>,
      document.body
    );
  }

  // --- ДЕСКТОП ВЕРСИЯ (Центрированная модалка) ---
  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-[1000] animate-in fade-in duration-300"
        onClick={onClose}
        // Указываем, что это интерактивный элемент
        role="button"
        // Исключаем из последовательности Tab (чтобы не фокусить фон специально)
        tabIndex={-1}
        // Обработка клавиш (Esc и Enter для доступности)
        onKeyDown={e => {
          if (e.key === 'Escape' || e.key === 'Enter') {
            onClose();
          }
        }}
        aria-label="Close modal"
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] bg-card/95 backdrop-blur-2xl border border-primary/10 rounded-[3rem] shadow-2xl z-[1001] overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black italic tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
