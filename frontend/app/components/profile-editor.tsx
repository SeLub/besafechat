import { validators } from '@/services/validators';
import { useEffect, useState } from 'react';

interface Handle {
  id: string;
  value: string;
  profile?: {
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    email: string | null;
    phone: string | null;
  };
}

interface ProfileUpdate {
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ProfileEditorProps {
  handle?: Handle;
  onSave: (handleId: string, updates: ProfileUpdate) => Promise<void>;
  isSaving?: boolean;
}

export function ProfileEditor({ handle, onSave, isSaving }: ProfileEditorProps) {
  const [formData, setFormData] = useState<ProfileUpdate>(() =>
    handle?.profile
      ? {
          displayName: handle.profile.displayName,
          firstName: handle.profile.firstName || '',
          lastName: handle.profile.lastName || '',
          bio: handle.profile.bio || '',
          email: handle.profile.email || '',
          phone: handle.profile.phone || '',
        }
      : {}
  );
  const [isDirty, setIsDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<'saved' | 'unsaved' | null>(null);

  // Sync form data when handle or profile changes
  useEffect(() => {
    if (!handle?.profile) {
      setFormData({});
      setIsDirty(false);
      return;
    }

    // Initialize form with profile data
    setFormData({
      displayName: handle.profile.displayName,
      firstName: handle.profile.firstName || '',
      lastName: handle.profile.lastName || '',
      bio: handle.profile.bio || '',
      email: handle.profile.email || '',
      phone: handle.profile.phone || '',
    });
    setIsDirty(false);

    // Load draft from localStorage if available
    const draft = localStorage.getItem(`handle-profile-draft-${handle.id}`);
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        setFormData(parsedDraft);
        setIsDirty(true);
        setDraftStatus('unsaved'); // Mark as unsaved draft loaded
      } catch (e) {
        console.error('Failed to parse localStorage draft:', e);
        setDraftStatus(null);
      }
    } else {
      setDraftStatus(null); // No draft
    }
  }, [handle?.id, handle?.profile]);

  const validateField = (field: string, value: string): string | null => {
    let validation: string | true = true;

    switch (field) {
      case 'email':
        validation = validators.email(value);
        break;
      case 'phone':
        validation = validators.phone(value);
        break;
      case 'displayName':
        validation = validators.displayName(value);
        break;
      case 'bio':
        validation = validators.bio(value);
        break;
      case 'firstName':
      case 'lastName':
        validation = validators.name(value);
        break;
      default:
        return null;
    }

    return validation === true ? null : validation;
  };

  const handleChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setIsDirty(true);
    setDraftStatus('unsaved'); // Mark as unsaved when user types

    // Validate field
    const error = validateField(field, value);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Save draft to localStorage
    localStorage.setItem(`handle-profile-draft-${handle?.id}`, JSON.stringify(updated));
  };

  const handleSave = async () => {
    if (!handle) return;

    // Validate all fields before saving
    const errors: Record<string, string> = {};
    Object.entries(formData).forEach(([field, value]) => {
      if (value) {
        const error = validateField(field, value as string);
        if (error) {
          errors[field] = error;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await onSave(handle.id, formData);
      // Clear draft on success
      localStorage.removeItem(`handle-profile-draft-${handle.id}`);
      setIsDirty(false);
      setFieldErrors({});
      setDraftStatus('saved');

      // Show "saved" status for 2 seconds then clear
      setTimeout(() => {
        setDraftStatus(null);
      }, 2000);
    } catch (error) {
      // Error toast shown in parent
      setDraftStatus(null);
    }
  };

  if (!handle) {
    return <div className="text-center text-foreground/60">Select a handle to edit</div>;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div>
        <label className="block text-sm font-bold mb-1">Display Name</label>
        <input
          type="text"
          value={formData.displayName || ''}
          onChange={e => handleChange('displayName', e.target.value)}
          className={`w-full rounded border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 ${
            fieldErrors.displayName
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-primary/20 focus:ring-primary/50'
          }`}
          placeholder="Your display name"
        />
        {fieldErrors.displayName && (
          <div className="text-red-600 text-xs mt-1">{fieldErrors.displayName}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-bold mb-1">First Name</label>
          <input
            type="text"
            value={formData.firstName || ''}
            onChange={e => handleChange('firstName', e.target.value)}
            className={`w-full rounded border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 ${
              fieldErrors.firstName
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-primary/20 focus:ring-primary/50'
            }`}
          />
          {fieldErrors.firstName && (
            <div className="text-red-600 text-xs mt-1">{fieldErrors.firstName}</div>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Last Name</label>
          <input
            type="text"
            value={formData.lastName || ''}
            onChange={e => handleChange('lastName', e.target.value)}
            className={`w-full rounded border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 ${
              fieldErrors.lastName
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-primary/20 focus:ring-primary/50'
            }`}
          />
          {fieldErrors.lastName && (
            <div className="text-red-600 text-xs mt-1">{fieldErrors.lastName}</div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">Bio</label>
        <textarea
          value={formData.bio || ''}
          onChange={e => handleChange('bio', e.target.value)}
          className={`w-full rounded border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 resize-none ${
            fieldErrors.bio
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-primary/20 focus:ring-primary/50'
          }`}
          rows={6}
          placeholder="Tell us about yourself"
        />
        {fieldErrors.bio && <div className="text-red-600 text-xs mt-1">{fieldErrors.bio}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-bold mb-1">Email</label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={e => handleChange('email', e.target.value)}
            className={`w-full rounded border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 ${
              fieldErrors.email
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-primary/20 focus:ring-primary/50'
            }`}
          />
          {fieldErrors.email && (
            <div className="text-red-600 text-xs mt-1">{fieldErrors.email}</div>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Phone</label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={e => handleChange('phone', e.target.value)}
            className={`w-full rounded border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 ${
              fieldErrors.phone
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-primary/20 focus:ring-primary/50'
            }`}
          />
          {fieldErrors.phone && (
            <div className="text-red-600 text-xs mt-1">{fieldErrors.phone}</div>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={!isDirty || isSaving || Object.keys(fieldErrors).length > 0}
          className="flex-1 bg-primary text-primary-foreground rounded px-4 py-2 font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {draftStatus === 'unsaved' && (
        <div className="text-xs text-red-600 text-center flex items-center justify-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" />
          You have unsaved changes (auto-saved to draft)
        </div>
      )}

      {draftStatus === 'saved' && (
        <div className="text-xs text-green-600 text-center flex items-center justify-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
          Changes saved successfully
        </div>
      )}
    </form>
  );
}
