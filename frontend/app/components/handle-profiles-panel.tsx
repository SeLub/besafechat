import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '@/services/api-utils';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { HandleProfilesModal } from './handle-profiles-modal';

interface Handle {
  id: string;
  value: string;
  alias: string | null;
  type: 'account' | 'team' | 'channel';
  isPrimary: boolean;
  isSearchable: boolean;
  createdAt: string;
  profile?: {
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    email: string | null;
    phone: string | null;
    settings: Record<string, any>;
  };
}

interface HandleProfilesPanelProps {
  isOpen: boolean;
  userProfile: any;
  onClose: () => void;
  layout?: 'modal' | 'drawer';
}

export function HandleProfilesPanel({
  isOpen,
  userProfile,
  onClose,
  layout = 'modal',
}: HandleProfilesPanelProps) {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHandles();
    }
  }, [isOpen]);

  const fetchHandles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[HandleProfilesPanel] Fetching handles from:', API_ENDPOINTS.HANDLES.GET_ALL);
      const response = await apiRequest<{ handles: Handle[] }>(API_ENDPOINTS.HANDLES.GET_ALL, {
        method: 'GET',
      });
      console.log('[HandleProfilesPanel] Handles response:', response);
      const handles = response.handles || [];
      console.log('[HandleProfilesPanel] Parsed handles:', handles.length);
      // Log each handle's profile data for debugging
      handles.forEach((h, i) => {
        console.log(`[HandleProfilesPanel] Handle ${i} (${h.value}):`, {
          id: h.id,
          hasProfile: !!h.profile,
          profile: h.profile
            ? {
                displayName: h.profile.displayName,
                email: h.profile.email,
                bio: h.profile.bio,
              }
            : null,
        });
      });
      setHandles(handles);
      if (handles.length > 0) {
        setSelectedHandleId(handles[0].id);
      }
    } catch (err: any) {
      console.error('[HandleProfilesPanel] Error fetching handles:', err);
      setError(err.message || 'Failed to load handles');
      toast.error('Failed to load handles: ' + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateHandle = async (handleName: string) => {
    try {
      const newHandle = await apiRequest<Handle>(API_ENDPOINTS.HANDLES.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          value: handleName,
          type: 'account',
          profileData: { displayName: 'Anonym User' },
        }),
      });
      setHandles([...handles, newHandle]);
      setSelectedHandleId(newHandle.id);
      setShowCreateForm(false);
      toast.success('Handle created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create handle');
      throw err;
    }
  };

  const handleSaveProfile = async (handleId: string, updates: any) => {
    try {
      setIsSaving(true);
      const response = await apiRequest<{ profile: any }>(
        API_ENDPOINTS.PROFILES.UPDATE_BY_HANDLE(handleId),
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      setHandles(
        handles.map(h => (h.id === handleId ? { ...h, profile: response.profile || h.profile } : h))
      );
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateHandle = async (handleId: string, updates: Partial<Handle>) => {
    try {
      setIsSaving(true);
      const response = await apiRequest<Handle>(
        API_ENDPOINTS.HANDLES.UPDATE(handleId),
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      setHandles(handles.map(h => (h.id === handleId ? { ...h, ...response } : h)));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update handle');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimaryHandle = async (handleId: string) => {
    try {
      setIsSaving(true);
      await apiRequest<Handle>(`/handles/${handleId}/primary`, {
        method: 'POST',
      });
      setHandles(handles.map(h => ({ ...h, isPrimary: h.id === handleId })));
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary handle');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (layout === 'modal') {
    return (
      <HandleProfilesModal
        isOpen={isOpen}
        handles={handles}
        selectedHandleId={selectedHandleId}
        isLoading={isLoading}
        isSaving={isSaving}
        showCreateForm={showCreateForm}
        onClose={onClose}
        onSelectHandle={setSelectedHandleId}
        onCreateHandle={() => setShowCreateForm(true)}
        onCancelCreate={() => setShowCreateForm(false)}
        onSubmitCreate={handleCreateHandle}
        onSaveProfile={handleSaveProfile}
        onUpdateHandle={handleUpdateHandle}
        onSetPrimaryHandle={handleSetPrimaryHandle}
      />
    );
  }

  return null;
}
