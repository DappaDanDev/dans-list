import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ImageUpload } from '../ImageUpload';

expect.extend(toHaveNoViolations);

describe('ImageUpload Component', () => {
  const mockOnFilesSelect = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    mockOnFilesSelect.mockClear();
    mockOnError.mockClear();
  });

  describe('Rendering', () => {
    it('should render upload area with correct text', () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument();
      expect(screen.getByText(/click.*upload/i)).toBeInTheDocument();
    });

    it('should have accessible upload button', () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const uploadInput = screen.getByLabelText(/upload image/i);
      expect(uploadInput).toBeInTheDocument();
      expect(uploadInput).toHaveAttribute('type', 'file');
      expect(uploadInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/gif');
    });
  });

  describe('File Upload', () => {
    it('should accept valid image files', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/upload image/i);

      await user.upload(input, file);

      await waitFor(() => {
        expect(mockOnFilesSelect).toHaveBeenCalledWith([file]);
      });
    });

    it('should show preview after file selection', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const file = new File(['image content'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 * 500 }); // 500KB

      const input = screen.getByLabelText(/upload image/i);
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByAltText(/preview/i)).toBeInTheDocument();
      });
    });

    it('should reject files larger than 10MB', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} onError={mockOnError} />);

      const file = new File(['large content'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 * 11 }); // 11MB

      const input = screen.getByLabelText(/upload image/i);
      await user.upload(input, file);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('large.jpg: File size must be less than 10MB');
        expect(mockOnFilesSelect).not.toHaveBeenCalled();
      });
    });

    it('should reject non-image files', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} onError={mockOnError} />);

      const file = new File(['text content'], 'document.txt', { type: 'text/plain' });

      const input = screen.getByLabelText(/upload image/i);
      await user.upload(input, file);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('document.txt'));
        expect(mockOnFilesSelect).not.toHaveBeenCalled();
      });
    });

    it('should handle multiple file uploads', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} maxFiles={3} />);

      const file1 = new File(['image1'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['image2'], 'test2.png', { type: 'image/png' });

      const input = screen.getByLabelText(/upload image/i);
      expect(input).toHaveAttribute('multiple');

      await user.upload(input, [file1, file2]);

      await waitFor(() => {
        expect(mockOnFilesSelect).toHaveBeenCalledWith([file1, file2]);
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over', () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const dropzone = screen.getByTestId('dropzone');

      fireEvent.dragOver(dropzone, {
        dataTransfer: { types: ['Files'] },
      });

      expect(dropzone).toHaveClass('border-blue-500');
    });

    it('should handle drag leave', () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const dropzone = screen.getByTestId('dropzone');

      fireEvent.dragOver(dropzone, {
        dataTransfer: { types: ['Files'] },
      });
      fireEvent.dragLeave(dropzone);

      expect(dropzone).not.toHaveClass('border-blue-500');
    });

    it('should handle file drop', async () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const dropzone = screen.getByTestId('dropzone');
      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(mockOnFilesSelect).toHaveBeenCalledWith([file]);
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when processing', () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} isProcessing />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it('should disable input when processing', () => {
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} isProcessing />);

      const input = screen.getByLabelText(/upload image/i);
      expect(input).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} />);

      const input = screen.getByLabelText(/upload image/i);

      await user.tab();
      expect(input).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<ImageUpload onFilesSelect={mockOnFilesSelect} onError={mockOnError} />);

      const file = new File(['text'], 'doc.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/upload image/i);

      await user.upload(input, file);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent(/doc.txt/i);
      });
    });
  });
});