import { X } from 'lucide-react';
import type { Handle } from '~/types/handle';
import { HandlesList } from './handles-list';
import { ProfileEditor } from './profile-editor';
import { ProfileAvatarSection } from './profile-avatar-section';

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
  if (!isOpen) return null;

  const selectedHandle = handles.find(h => h.id === selectedHandleId);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-2xl max-w-6xl w-full max-h-[700px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-primary/10">
            <h2 className="text-xl font-black">Handle & Profiles</h2>
            <button
              onClick={onClose}
              className="text-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left: Handles List */}
              <div className="col-span-3 border-r border-primary/10 pr-6">
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
                <div className="col-span-3 border-r border-primary/10 pr-6">
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
              <div className="col-span-6">
                <ProfileEditor handle={selectedHandle} onSave={onSaveProfile} isSaving={isSaving} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
