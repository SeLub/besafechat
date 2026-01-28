import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';

export default function S3TestRoute() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPath, setUploadPath] = useState('media/test');
  const [downloadPath, setDownloadPath] = useState('media/test');
  const [filename, setFilename] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFilename(e.target.files[0].name);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setIsUploading(true);
    try {
      await import('~/services/s3-service').then(({ S3Service }) => {
        return S3Service.uploadFile(selectedFile, {
          path: uploadPath,
          fileName: filename,
          contentType: selectedFile.type,
        });
      });
      toast.success('File uploaded successfully');
      // Add to file list for reference
      if (!fileList.includes(`${uploadPath}/${filename}`)) {
        setFileList([...fileList, `${uploadPath}/${filename}`]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!filename) {
      toast.error('Please enter a filename');
      return;
    }

    setIsDownloading(true);
    try {
      const downloadUrl = await import('~/services/s3-service').then(({ S3Service }) => {
        return S3Service.getFileUrl(downloadPath, filename);
      });

      // Open in new tab/window instead of downloading directly
      window.open(downloadUrl, '_blank');

      toast.success('Download opened in new tab');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!filename) {
      toast.error('Please enter a filename');
      return;
    }

    setIsDeleting(true);
    try {
      await import('~/services/s3-service').then(({ S3Service }) => {
        return S3Service.deleteFile(downloadPath, filename);
      });

      toast.success('File deleted successfully');
      // Remove from file list
      setFileList(fileList.filter(file => file !== `${downloadPath}/${filename}`));
    } catch (error: any) {
      console.error('Delete error:', error);
      // Check if it's a 404 error (file not found) or specific message from backend
      if (
        error.message &&
        (error.message.includes('404') ||
          error.message.includes('NotFound') ||
          error.message.includes('File does not exist'))
      ) {
        toast.error('File not found');
      } else if (error.message && error.message.includes('Cannot delete files from other users')) {
        toast.error('Cannot delete files from other users');
      } else {
        toast.error('Failed to delete file: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">S3 Test Interface</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Upload File</h2>

          <div className="mb-4">
            <label htmlFor="selectFile" className="block text-sm font-medium mb-1">
              Select File
            </label>
            <input
              type="file"
              id="selectFile"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="uploadPath" className="block text-sm font-medium mb-1">
              Upload Path
            </label>
            <input
              type="text"
              id="uploadPath"
              value={uploadPath}
              onChange={e => setUploadPath(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g., media/test"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="uploadFilename" className="block text-sm font-medium mb-1">
              Filename
            </label>
            <input
              type="text"
              id="uploadFilename"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g., my-image.jpg"
            />
          </div>

          <Button onClick={handleUpload} disabled={isUploading || !selectedFile} className="w-full">
            {isUploading ? 'Uploading...' : 'Upload File'}
          </Button>
        </div>

        {/* Download/Delete Section */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Download/Delete File</h2>

          <div className="mb-4">
            <label htmlFor="downloadPath" className="block text-sm font-medium mb-1">
              Download Path
            </label>
            <input
              type="text"
              id="downloadPath"
              value={downloadPath}
              onChange={e => setDownloadPath(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g., media/test"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="downloadFilename" className="block text-sm font-medium mb-1">
              Filename
            </label>
            <input
              type="text"
              id="downloadFilename"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g., my-image.jpg"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button onClick={handleDownload} disabled={isDownloading || !filename}>
              {isDownloading ? 'Downloading...' : 'Download File'}
            </Button>

            <Button onClick={handleDelete} disabled={isDeleting || !filename} variant="destructive">
              {isDeleting ? 'Deleting...' : 'Delete File'}
            </Button>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="mt-8 border p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
        {fileList.length > 0 ? (
          <ul className="list-disc pl-5">
            {fileList.map((file, index) => (
              <li key={index} className="mb-1">
                {file}
              </li>
            ))}
          </ul>
        ) : (
          <p>No files uploaded yet</p>
        )}
      </div>
    </div>
  );
}
