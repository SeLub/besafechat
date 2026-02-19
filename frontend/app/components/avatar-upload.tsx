import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MediaService } from '@/services/media.service';
import { useAvatarUpdate } from '~/hooks/avatar-update-context';

interface AvatarUploadProps {
  avatarUrl?: string | null;
  fallback: string;
  handleId?: string;
  onUploadSuccess?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Reusable avatar upload component
 * Handles file selection, validation, upload, and display
 */
export function AvatarUpload({
  avatarUrl,
  fallback,
  handleId,
  onUploadSuccess,
  size = 'md',
  showLabel = true,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lastAvatarUpdateTimestamp, triggerAvatarUpdate } = useAvatarUpdate();

  const sizeClasses = {
    sm: { container: 'h-16 w-16', icon: 'h-4 w-4', button: 'h-7 w-7' },
    md: { container: 'h-24 w-24', icon: 'h-5 w-5', button: 'h-10 w-10' },
    lg: { container: 'h-28 w-28', icon: 'h-6 w-6', button: 'h-12 w-12' },
  };

  const sizeConfig = sizeClasses[size];

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Supported formats: JPG, PNG, WebP');
      return;
    }

    setUploading(true);
    try {
      // Upload avatar using MediaService
      await MediaService.uploadAvatar(file, handleId);
      toast.success('Avatar updated successfully');

      // Trigger avatar update in context to force image reload
      triggerAvatarUpdate();

      // Call optional callback
      onUploadSuccess?.();
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative inline-block group cursor-pointer">
        <Avatar className={`${sizeConfig.container} ring-4 ring-background shadow-2xl`}>
          <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white font-black">
            {fallback}
          </AvatarFallback>
          {avatarUrl && (
            <AvatarImage
              src={`${avatarUrl}?v=${lastAvatarUpdateTimestamp}`}
              className="object-cover"
            />
          )}
        </Avatar>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        {/* Overlay with upload button */}
        <button
          type="button"
          className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${sizeConfig.container} hover:bg-black/60 z-20`}
          onClick={handleAvatarClick}
          disabled={uploading}
          aria-label="Change avatar"
        >
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <Camera className="h-6 w-6 text-white" />
            <span className="text-xs text-white font-bold">
              {uploading ? 'Uploading...' : 'Change photo'}
            </span>
          </div>
        </button>

        {/* Fallback button for mobile/non-hover */}
        <Button
          size="icon"
          className={`absolute -bottom-2 -right-2 rounded-full shadow-lg hover:scale-110 transition-transform bg-primary text-white hover:bg-primary/90 ${sizeConfig.button}`}
          onClick={handleAvatarClick}
          disabled={uploading}
        >
          <Camera className={sizeConfig.icon} />
        </Button>
      </div>

      {showLabel && (
        <div className="text-center">
          <div className="text-xs font-bold text-primary/60">
            {uploading ? 'Uploading...' : 'Hover or click to upload'}
          </div>
        </div>
      )}
    </div>
  );
}
