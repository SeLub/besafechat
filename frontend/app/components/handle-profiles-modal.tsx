import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { Handle } from '~/types/handle';
import { HandlesList } from './handles-list';
import { ProfileEditor } from './profile-editor';
import { ProfileAvatarSection } from './profile-avatar-section';
import { useMediaQuery } from '~/hooks/use-media-query';

interface HandleProfilesModalProps {
  isOpen: boolean;
  handles: Handle[];
  selectedHandleId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSelectHandle: (id: string) => void;
  onCreateHandle: () => void;
  onSaveProfile: (handleId: string, updates: any) => Promise<void>;
  onUpdateHandle: (handleId: string, updates: Partial<Handle>) => Promise<void>;
  onSetPrimaryHandle: (handleId: string) => Promise<void>;
  onDeleteHandle?: (handleId: string) => Promise<void>;
}

/**
 * Renders HandleProfilesModal that automatically adapts to device type:
 * - Desktop/Tablet: 3-column modal (list | avatar | editor) - wide 1000px
 * - Mobile: Drawer with stacked layout (accordion-style)
 */
export function HandleProfilesModal({
  isOpen,
  handles,
  selectedHandleId,
  isLoading,
  isSaving,
  onClose,
  onSelectHandle,
  onCreateHandle,
  onSaveProfile,
  onUpdateHandle,
  onSetPrimaryHandle,
  onDeleteHandle,
}: HandleProfilesModalProps) {
  const { isMobile, isTablet } = useMediaQuery();
  const [mounted, setMounted] = React.useState(false);
  const selectedHandle = handles.find(h => h.id === selectedHandleId);

  React.useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  // --- МОБИЛЬНАЯ ВЕРСИЯ (Drawer/BottomSheet) ---
  if (isMobile) {
    return createPortal(
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Drawer.Root open={isOpen} onOpenChange={open => !open && onClose()}>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]" />
              <Drawer.Content className="bg-card fixed bottom-0 left-0 right-0 z-[1001] flex flex-col rounded-t-[2.5rem] border-t border-primary/10 outline-none">
                {/* Dialog Title and Description for accessibility */}
                <Dialog.Title className="sr-only">Handle & Profiles</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Modal content for Handle & Profiles
                </Dialog.Description>

                {/* Decorative swipe bar */}
                <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-primary/20" />

                <div className="p-6 overflow-y-auto max-h-[80vh]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black italic tracking-tight">Handle & Profiles</h2>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full bg-primary/5"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Handles List */}
                    <div>
                      <HandlesList
                        handles={handles}
                        selectedHandleId={selectedHandleId}
                        onSelectHandle={onSelectHandle}
                        onCreateHandle={onCreateHandle}
                        isLoading={isLoading}
                      />
                    </div>

                    {/* Selected Handle Details */}
                    {selectedHandle && (
                      <div className="space-y-4 pt-2 border-t border-primary/10">
                        {/* Avatar Section */}
                        <ProfileAvatarSection
                          handle={selectedHandle}
                          onUpdateHandle={onUpdateHandle}
                          onSetPrimary={onSetPrimaryHandle}
                          onDeleteHandle={onDeleteHandle}
                          isLoading={isSaving}
                        />

                        {/* Profile Editor */}
                        <ProfileEditor
                          handle={selectedHandle}
                          onSave={onSaveProfile}
                          isSaving={isSaving}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </Dialog.Portal>
      </Dialog.Root>,
      document.body
    );
  }

  // --- ДЕСКТОП/ПЛАНШЕТ ВЕРСИЯ (Центрированная модалка - широкая) ---
  return createPortal(
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/60 backdrop-blur-md z-[1000]" />
        <Dialog.Content className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full bg-card rounded-[2rem] shadow-2xl z-[1001] overflow-hidden flex flex-col max-h-[85vh] ${
          isTablet ? 'max-w-[90vw]' : 'max-w-[1200px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-primary/10">
            <h2 className="text-xl font-black">Handle & Profiles</h2>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left: Handles List */}
              <div className="col-span-3 border-r border-primary/10 pr-6 overflow-y-auto">
                <HandlesList
                  handles={handles}
                  selectedHandleId={selectedHandleId}
                  onSelectHandle={onSelectHandle}
                  onCreateHandle={onCreateHandle}
                  isLoading={isLoading}
                />
              </div>

              {/* Middle: Profile Avatar & Settings */}
              {selectedHandle && (
                <div className="col-span-3 border-r border-primary/10 pr-6 overflow-y-auto">
                  <ProfileAvatarSection
                    handle={selectedHandle}
                    onUpdateHandle={onUpdateHandle}
                    onSetPrimary={onSetPrimaryHandle}
                    onDeleteHandle={onDeleteHandle}
                    isLoading={isSaving}
                  />
                </div>
              )}

              {/* Right: Profile Editor */}
              <div className="col-span-6 overflow-y-auto">
                <ProfileEditor handle={selectedHandle} onSave={onSaveProfile} isSaving={isSaving} />
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
    document.body
  );
}
