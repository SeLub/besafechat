import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/hooks/use-theme";
import { Check } from "lucide-react";

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSelectorModal({
  isOpen,
  onClose,
}: ThemeSelectorModalProps) {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      id: "besafe" as const,
      name: "BeSafe",
      description: "Privacy-focused green theme",
    },
    {
      id: "telegram" as const,
      name: "Telegram",
      description: "Classic blue messenger",
    },
    {
      id: "minimal" as const,
      name: "Minimal",
      description: "Clean monochrome design",
    },
  ];

  const handleThemeSelect = (themeId: typeof theme) => {
    setTheme(themeId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Theme</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {themes.map((t) => (
            <div
              key={t.id}
              onClick={() => handleThemeSelect(t.id)}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
            >
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-muted-foreground">
                  {t.description}
                </div>
              </div>
              {theme === t.id && <Check className="h-5 w-5 text-primary" />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
