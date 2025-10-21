'use client';

import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export interface ImageUploadProps {
  onFilesSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  isProcessing?: boolean;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedTypes?: string[];
}

export function ImageUpload({
  onFilesSelect,
  onError,
  isProcessing = false,
  maxFiles = 1,
  maxSizeInMB = 10,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/gif'],
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return `Please upload one of: ${acceptedTypes.join(', ')}`;
    }

    // Check file size
    const maxSize = maxSizeInMB * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size must be less than ${maxSizeInMB}MB`;
    }

    return null;
  };

  const handleFiles = useCallback(
    (files: FileList) => {
      const fileArray = Array.from(files).slice(0, maxFiles);

      if (files.length > maxFiles) {
        setError(`You can only upload up to ${maxFiles} files`);
        onError?.(`You can only upload up to ${maxFiles} files`);
        return;
      }

      const errors: string[] = [];
      const validFiles: File[] = [];
      const newPreviews: string[] = [];

      fileArray.forEach(file => {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(`${file.name}: ${validationError}`);
        } else {
          validFiles.push(file);
          // Create preview
          const reader = new FileReader();
          reader.onloadend = () => {
            newPreviews.push(reader.result as string);
            if (newPreviews.length === validFiles.length) {
              setPreviews(newPreviews);
            }
          };
          reader.readAsDataURL(file);
        }
      });

      if (errors.length > 0) {
        setError(errors.join(', '));
        onError?.(errors.join(', '));
      } else {
        setError(null);
        onFilesSelect(validFiles);
      }
    },
    [onFilesSelect, onError, maxFiles, maxSizeInMB, acceptedTypes]
  );

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        data-testid="dropzone"
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-all duration-200 cursor-pointer
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          disabled={isProcessing}
          multiple={maxFiles > 1}
          className="sr-only"
          aria-label="Upload images"
          id="image-upload-input"
        />
        <label htmlFor="image-upload-input" className="sr-only">
          Upload image
        </label>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <LoadingSpinner />
            <p className="text-gray-600">Processing images...</p>
          </div>
        ) : previews.length > 0 ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-md">
              {previews.map((preview, index) => (
                <img
                  key={index}
                  src={preview}
                  alt={`Preview of uploaded image ${index + 1}`}
                  className="h-32 w-32 object-cover rounded-lg shadow-lg"
                />
              ))}
            </div>
            <p className="text-sm text-gray-600">
              {previews.length} {previews.length === 1 ? 'image' : 'images'} ready for upload
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-700">
                Drag & drop your {maxFiles > 1 ? 'images' : 'image'} here
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to upload {maxFiles > 1 ? `(max ${maxFiles} files)` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} up to {maxSizeInMB}MB each
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}