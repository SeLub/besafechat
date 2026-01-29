import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { MediaService, MediaType } from '~/services/media.service';

export default function MediaTestRoute() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.AVATAR);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    // Validate file based on type
    let isValid = false;
    switch (mediaType) {
      case MediaType.AVATAR:
        isValid = MediaService.validateAvatarFile(selectedFile);
        break;
      case MediaType.IMAGE:
        isValid = MediaService.validateImageFile(selectedFile);
        break;
      case MediaType.DOCUMENT:
        isValid = MediaService.validateDocumentFile(selectedFile);
        break;
      case MediaType.AUDIO:
        isValid = MediaService.validateAudioFile(selectedFile);
        break;
      case MediaType.VIDEO:
        isValid = MediaService.validateVideoFile(selectedFile);
        break;
    }

    if (!isValid) {
      toast.error(`Invalid file type or size for ${mediaType}`);
      return;
    }

    setIsUploading(true);
    try {
      let result;
      switch (mediaType) {
        case MediaType.AVATAR:
          result = await MediaService.uploadAvatar(selectedFile);
          break;
        case MediaType.IMAGE:
          result = await MediaService.uploadImage(selectedFile);
          break;
        case MediaType.DOCUMENT:
          result = await MediaService.uploadDocument(selectedFile);
          break;
        case MediaType.AUDIO:
          result = await MediaService.uploadAudio(selectedFile);
          break;
        case MediaType.VIDEO:
          result = await MediaService.uploadVideo(selectedFile);
          break;
        default:
          throw new Error('Unsupported media type');
      }

      setUploadedUrl(result.url);
      toast.success(`${mediaType} uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${mediaType}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (mediaType === MediaType.AVATAR) {
      try {
        await MediaService.deleteAvatar();
        setUploadedUrl(null);
        toast.success('Avatar deleted successfully');
      } catch (error) {
        toast.error('Failed to delete avatar');
      }
    }
  };

  const getAcceptTypes = () => {
    switch (mediaType) {
      case MediaType.AVATAR:
      case MediaType.IMAGE:
        return 'image/*';
      case MediaType.DOCUMENT:
        return '.pdf,.doc,.docx,.xls,.xlsx,.txt';
      case MediaType.AUDIO:
        return 'audio/*';
      case MediaType.VIDEO:
        return 'video/*';
      default:
        return '*/*';
    }
  };

  const getMaxSize = () => {
    switch (mediaType) {
      case MediaType.AVATAR:
        return '5MB';
      case MediaType.IMAGE:
        return '10MB';
      case MediaType.DOCUMENT:
        return '50MB';
      case MediaType.AUDIO:
        return '20MB';
      case MediaType.VIDEO:
        return '25MB';
      default:
        return 'N/A';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Media Upload Test</h1>

      {/* Media Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Media Type</label>
        <select
          value={mediaType}
          onChange={e => setMediaType(e.target.value as MediaType)}
          className="w-full p-2 border rounded-lg"
        >
          <option value={MediaType.AVATAR}>Avatar (5MB, auto-resize to 256x256)</option>
          <option value={MediaType.IMAGE}>Image (10MB, for chat messages)</option>
          <option value={MediaType.DOCUMENT}>Document (50MB, PDF/DOC/etc)</option>
          <option value={MediaType.AUDIO}>Audio (20MB, voice messages)</option>
          <option value={MediaType.VIDEO}>Video (25MB, for chat messages)</option>
        </select>
      </div>

      {/* File Upload */}
      <div className="border p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload {mediaType}</h2>

        <div className="mb-4">
          <label htmlFor="selectFile" className="block text-sm font-medium mb-1">
            Select File (Max: {getMaxSize()})
          </label>
          <input
            type="file"
            id="selectFile"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={getAcceptTypes()}
            className="w-full p-2 border rounded"
          />
        </div>

        {selectedFile && (
          <div className="mb-4 p-2 bg-gray-100 rounded">
            <p>
              <strong>File:</strong> {selectedFile.name}
            </p>
            <p>
              <strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <p>
              <strong>Type:</strong> {selectedFile.type}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleUpload} disabled={isUploading || !selectedFile} className="flex-1">
            {isUploading ? 'Uploading...' : `Upload ${mediaType}`}
          </Button>

          {mediaType === MediaType.AVATAR && uploadedUrl && (
            <Button onClick={handleDelete} variant="destructive">
              Delete Avatar
            </Button>
          )}
        </div>
      </div>

      {/* Upload Result */}
      {uploadedUrl && (
        <div className="border p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload Result</h2>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">URL:</p>
            <p className="break-all bg-gray-100 p-2 rounded text-sm">{uploadedUrl}</p>
          </div>

          {(mediaType === MediaType.AVATAR || mediaType === MediaType.IMAGE) && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Preview:</p>
              <img
                src={uploadedUrl}
                alt="Uploaded media"
                className="max-w-xs max-h-64 border rounded"
                onError={() => toast.error('Failed to load image')}
              />
            </div>
          )}

          {mediaType === MediaType.AUDIO && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Audio Player:</p>
              <audio controls className="w-full">
                <source src={uploadedUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>
      )}

      {/* API Info */}
      <div className="text-sm text-gray-600">
        <h3 className="font-semibold mb-2">New Unified Media API:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <code>POST /media/upload/avatar</code> - Avatar upload (auto-resize)
          </li>
          <li>
            <code>POST /media/upload/image</code> - Chat images
          </li>
          <li>
            <code>POST /media/upload/document</code> - Documents
          </li>
          <li>
            <code>POST /media/upload/audio</code> - Voice messages
          </li>
          <li>
            <code>DELETE /media/avatar</code> - Delete avatar
          </li>
        </ul>
        <p className="mt-2">
          <strong>S3 Structure:</strong> <code>handles/&#123;hash16&#125;/avatar.png</code>
        </p>
      </div>
    </div>
  );
}
