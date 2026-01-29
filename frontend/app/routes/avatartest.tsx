import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { MediaService } from '~/services/media.service';

export default function AvatarTestRoute() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image file first');
      return;
    }

    setIsUploading(true);
    try {
      const result = await MediaService.uploadAvatar(selectedFile);
      // Add timestamp for cache busting
      setAvatarUrl(`${result.url}?t=${Date.now()}`);
      toast.success('Avatar uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await MediaService.deleteAvatar();
      setAvatarUrl(null);
      toast.success('Avatar deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete avatar');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <h1 className="text-3xl font-bold mb-6">Avatar Test</h1>

      {/* Current Avatar */}
      <div className="mb-6 text-center">
        <div className="w-32 h-32 mx-auto mb-4 border rounded-full overflow-hidden bg-gray-100">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Avatar
            </div>
          )}
        </div>
        {avatarUrl && <p className="text-sm text-gray-600 break-all">{avatarUrl}</p>}
      </div>

      {/* Upload Section */}
      <div className="border p-4 rounded-lg mb-4">
        <h2 className="text-xl font-semibold mb-4">Upload Avatar</h2>

        <div className="mb-4">
          <label htmlFor="selectFile" className="block text-sm font-medium mb-1">
            Select Image (PNG, JPG, GIF - max 5MB)
          </label>
          <input
            type="file"
            id="selectFile"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="w-full p-2 border rounded"
          />
        </div>

        <Button
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          className="w-full mb-2"
        >
          {isUploading ? 'Uploading...' : 'Upload Avatar'}
        </Button>

        <Button
          onClick={handleDelete}
          disabled={isDeleting || !avatarUrl}
          variant="destructive"
          className="w-full"
        >
          {isDeleting ? 'Deleting...' : 'Delete Avatar'}
        </Button>
      </div>

      <div className="text-sm text-gray-600">
        <p>• Images will be resized to 256x256 PNG</p>
        <p>• Avatar URL is generated dynamically by server</p>
        <p>• Storage path: avatars/&#123;hash&#125;/avatar.png</p>
      </div>
    </div>
  );
}
