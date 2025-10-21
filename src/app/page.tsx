'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  ImageUpload,
  LoadingSpinner,
  ErrorBoundary
} from './components';

export default function ComponentShowcase() {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [numberValue, setNumberValue] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleImageSelect = (files: File[]) => {
    setSelectedImages(files);
    console.log('Selected images:', files.map(f => f.name));
  };

  const handleButtonClick = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  const ThrowError = () => {
    if (showError) {
      throw new Error('This is a test error!');
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Dan's List Component Showcase
          </h1>
          <p className="text-gray-600">
            Phase 1 UI Components - Built with TDD and Accessibility
          </p>
        </header>

        <div className="space-y-12">
          {/* Button Component */}
          <section className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">Button Component</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="outline">Outline</Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Sizes</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">States</h3>
                <div className="flex flex-wrap gap-3">
                  <Button disabled>Disabled</Button>
                  <Button isLoading>Loading</Button>
                  <Button fullWidth>Full Width</Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">With Icons</h3>
                <div className="flex flex-wrap gap-3">
                  <Button leftIcon={<span>←</span>}>Back</Button>
                  <Button rightIcon={<span>→</span>}>Next</Button>
                  <Button
                    variant="danger"
                    leftIcon={<span>🗑</span>}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Interactive Demo</h3>
                <Button
                  onClick={handleButtonClick}
                  isLoading={isLoading}
                  variant="primary"
                >
                  {isLoading ? 'Processing...' : 'Click to Load'}
                </Button>
              </div>
            </div>
          </section>

          {/* Input Component */}
          <section className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">Input Component</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Text Input"
                placeholder="Enter some text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                helperText="This is helper text"
              />

              <Input
                label="Required Field"
                placeholder="This field is required"
                required
              />

              <Input
                label="Email Input"
                type="email"
                placeholder="email@example.com"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />

              <Input
                label="Password Input"
                type="password"
                placeholder="Enter password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
              />

              <Input
                label="Number Input"
                type="number"
                placeholder="Enter a number"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
              />

              <Input
                label="Search Input"
                type="search"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                leftIcon={<span>🔍</span>}
              />

              <Input
                label="Input with Error"
                error="This field has an error"
                placeholder="Error state"
              />

              <Input
                label="Disabled Input"
                disabled
                value="Cannot edit this"
              />

              <div className="md:col-span-2">
                <Input
                  label="Textarea"
                  multiline
                  rows={4}
                  placeholder="Enter multiple lines of text..."
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                  helperText="You can enter multiple lines here"
                />
              </div>

              <Input
                label="With Left Icon"
                leftIcon={<span>👤</span>}
                placeholder="Username"
              />

              <Input
                label="With Right Icon"
                rightIcon={<span>✓</span>}
                placeholder="Verified input"
              />
            </div>
          </section>

          {/* Image Upload Component */}
          <section className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">Image Upload Component</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Single Image</h3>
                <ImageUpload
                  onFilesSelect={handleImageSelect}
                  maxFiles={1}
                />
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Multiple Images (Max 5)</h3>
                <ImageUpload
                  onFilesSelect={handleImageSelect}
                  maxFiles={5}
                />
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Custom Accept Types</h3>
                <ImageUpload
                  onFilesSelect={handleImageSelect}
                  acceptedTypes={['image/png', 'image/gif']}
                  maxFiles={3}
                />
              </div>

              {selectedImages.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Selected Files:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedImages.map((file, index) => (
                      <li key={index} className="text-gray-600">
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Loading Spinner Component */}
          <section className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">Loading Spinner Component</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Sizes</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <LoadingSpinner size="sm" />
                    <p className="mt-2 text-sm text-gray-600">Small</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner size="md" />
                    <p className="mt-2 text-sm text-gray-600">Medium</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="mt-2 text-sm text-gray-600">Large</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Colors</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <LoadingSpinner color="blue" />
                    <p className="mt-2 text-sm text-gray-600">Blue</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner color="gray" />
                    <p className="mt-2 text-sm text-gray-600">Gray</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner color="white" className="bg-gray-800 p-4 rounded" />
                    <p className="mt-2 text-sm text-gray-600">White</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Inline with Button</h3>
                <Button isLoading variant="primary">
                  Loading Button
                </Button>
              </div>
            </div>
          </section>

          {/* Error Boundary Component */}
          <section className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">Error Boundary Component</h2>

            <div className="space-y-6">
              <p className="text-gray-600">
                The Error Boundary component catches JavaScript errors in child components
                and displays a fallback UI. Click the button below to trigger an error.
              </p>

              <ErrorBoundary
                fallback={(error) => (
                  <div className="border border-red-300 bg-red-50 p-4 rounded-lg">
                    <h3 className="text-red-800 font-semibold mb-2">
                      Error Caught by Boundary
                    </h3>
                    <p className="text-red-600 text-sm">{error.message}</p>
                  </div>
                )}
              >
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3">Protected Component</h3>
                  <ThrowError />
                  <Button
                    variant={showError ? 'primary' : 'danger'}
                    onClick={() => setShowError(!showError)}
                  >
                    {showError ? 'Component Will Error on Render' : 'Click to Trigger Error'}
                  </Button>
                  {!showError && (
                    <p className="mt-3 text-sm text-gray-600">
                      Component is working normally. Click the button to trigger an error.
                    </p>
                  )}
                </div>
              </ErrorBoundary>
            </div>
          </section>
        </div>

        <footer className="mt-12 py-8 text-center text-gray-600">
          <p>Dan's List - Phase 1 Components</p>
          <p className="text-sm mt-2">
            Built with Next.js 14, TypeScript, Tailwind CSS, and TDD
          </p>
        </footer>
      </div>
    </div>
  );
}