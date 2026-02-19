import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '@/services/api-utils';
import { API_ENDPOINTS } from '@/services/api-gateway';
import type { Handle } from '~/types/handle';
import { HandleProfilesModal } from './handle-profiles-modal';

interface HandleProfilesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layout?: 'modal' | 'drawer';
}

export function HandleProfilesPanel({
  isOpen,
  onClose,
  layout = 'modal',
}: HandleProfilesPanelProps) {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHandles();
    }
  }, [isOpen]);

  const fetchHandles = async () => {
    try {
      setIsLoading(true);
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
      toast.error('Failed to load handles: ' + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateHandle = async () => {
    try {
      setIsSaving(true);
      const response = await apiRequest<Handle>(API_ENDPOINTS.HANDLES.CREATE, {
        method: 'POST',
        body: JSON.stringify({ type: 'account' }),
      });
      const newHandle = response;
      setHandles([...handles, newHandle]);
      setSelectedHandleId(newHandle.id);
      toast.success('Handle created successfully');
    } catch (err: any) {
      console.error('[HandleProfilesPanel] Error creating handle:', err);
      toast.error(err.message || 'Failed to create handle');
    } finally {
      setIsSaving(false);
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
    // Simply update the local state with the new handle data
    // This is called by specialized endpoints (alias, searchable, primary)
    // which handle the API calls and validation themselves
    setHandles(handles.map(h => (h.id === handleId ? { ...h, ...updates } : h)));
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

  const handleDeleteHandle = async (handleId: string) => {
    try {
      setIsSaving(true);
      const response = await apiRequest<{ handles: Handle[] }>(
        API_ENDPOINTS.HANDLES.DELETE(handleId),
        {
          method: 'DELETE',
        }
      );

      // Use the updated handles list from the server
      const updatedHandles = response.handles || [];
      setHandles(updatedHandles);

      // If deleted handle was selected, select the first remaining handle
      if (selectedHandleId === handleId) {
        setSelectedHandleId(updatedHandles.length > 0 ? updatedHandles[0].id : null);
      }

      toast.success('Handle deleted successfully');
    } catch (err: any) {
      console.error('[HandleProfilesPanel] Error deleting handle:', err);
      toast.error(err.message || 'Failed to delete handle');
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
        onClose={onClose}
        onSelectHandle={setSelectedHandleId}
        onCreateHandle={handleCreateHandle}
        onSaveProfile={handleSaveProfile}
        onUpdateHandle={handleUpdateHandle}
        onSetPrimaryHandle={handleSetPrimaryHandle}
        onDeleteHandle={handleDeleteHandle}
      />
    );
  }

  return null;
}
