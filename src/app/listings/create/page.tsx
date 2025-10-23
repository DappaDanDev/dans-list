'use client';

/**
 * Create Listing Page
 *
 * Allows sellers to create new marketplace listings using AI-powered image analysis
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUpload } from '@/app/components/ImageUpload';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import Link from 'next/link';

interface AnalyzedListing {
  title: string;
  category: string;
  condition: string;
  price: number;
  description: string;
}

export default function CreateListingPage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'edit' | 'submitting'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [analyzedData, setAnalyzedData] = useState<AnalyzedListing | null>(null);
  const [editedData, setEditedData] = useState<AnalyzedListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Handle file selection
  const handleFilesSelect = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Automatically trigger analysis
    await analyzeImage(file);
  };

  // Analyze image with AI
  const analyzeImage = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Image = reader.result as string;

          // Call analysis API using multipart/form-data
          const formData = new FormData();
          formData.append('image', base64Image);

          const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
          });

          const responseBody = await (async () => {
            const jsonClone = response.clone();
            try {
              return await jsonClone.json();
            } catch {
              const text = await response.text();
              try {
                return JSON.parse(text);
              } catch {
                return { error: text };
              }
            }
          })();

          if (!response.ok) {
            const message =
              (responseBody && responseBody.error) ||
              (typeof responseBody === 'string' ? responseBody : null) ||
              'Failed to analyze image';
            throw new Error(message);
          }

          const data = responseBody;
          setAnalyzedData(data);
          setEditedData(data);
          setStep('edit');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setIsAnalyzing(false);
    }
  };

  // Handle form field changes
  const handleFieldChange = (field: keyof AnalyzedListing, value: string | number) => {
    if (!editedData) return;
    setEditedData({
      ...editedData,
      [field]: value,
    });
  };

  // Submit listing
  const handleSubmit = async () => {
    if (!editedData || !walletAddress) {
      setError('Please provide wallet address');
      return;
    }

    setStep('submitting');
    setError(null);

    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editedData,
          sellerAddress: walletAddress,
          imageUrl: imagePreview,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create listing');
      }

      const listing = await response.json();

      // Redirect to the new listing
      router.push(`/listings/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
      setStep('edit');
    }
  };

  // Reset form
  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setImagePreview('');
    setAnalyzedData(null);
    setEditedData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/listings"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Listings
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Create New Listing</h1>
          <p className="text-gray-600 mt-2">
            Upload a product image and our AI will automatically extract listing details
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Step 1: Upload Image */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Step 1: Upload Product Image
            </h2>
            <ImageUpload
              onFilesSelect={handleFilesSelect}
              onError={setError}
              isProcessing={isAnalyzing}
              maxFiles={1}
              maxSizeInMB={10}
            />
            {isAnalyzing && (
              <p className="text-center text-gray-600 mt-4">
                Analyzing image with AI...
              </p>
            )}
          </div>
        )}

        {/* Step 2: Edit Details */}
        {step === 'edit' && editedData && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                Step 2: Review & Edit Details
              </h2>
              <Button onClick={handleReset} variant="outline" size="sm">
                Upload Different Image
              </Button>
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-6">
                <img
                  src={imagePreview}
                  alt="Product preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <Input
                  value={editedData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="Product title"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <Input
                    value={editedData.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    placeholder="e.g., Electronics"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition
                  </label>
                  <select
                    value={editedData.condition}
                    onChange={(e) => handleFieldChange('condition', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (USDC)
                </label>
                <Input
                  type="number"
                  value={editedData.price}
                  onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editedData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Detailed description of the product"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Wallet Address
                </label>
                <Input
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  required
                  pattern="^0x[a-fA-F0-9]{40}$"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is where you'll receive payments for this listing
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex gap-4">
              <Button
                onClick={handleSubmit}
                variant="primary"
                size="lg"
                fullWidth
                disabled={!walletAddress || step === 'submitting'}
              >
                Create Listing
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Submitting */}
        {step === 'submitting' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Creating Your Listing
              </h2>
              <p className="text-gray-600">
                Please wait while we save your listing to the marketplace...
              </p>
            </div>
          </div>
        )}

        {/* AI Features Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            AI-Powered Listing Creation
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Automatic product title and category detection</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Smart price estimation based on product condition</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>AI-generated descriptions that highlight key features</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>You can review and edit all details before publishing</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
