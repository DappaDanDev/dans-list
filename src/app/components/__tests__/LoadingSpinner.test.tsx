import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoadingSpinner } from '../LoadingSpinner';

expect.extend(toHaveNoViolations);

describe('LoadingSpinner Component', () => {
  describe('Rendering', () => {
    it('should render spinner element', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should apply default size', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('should apply small size', () => {
      render(<LoadingSpinner size="sm" />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });

    it('should apply medium size', () => {
      render(<LoadingSpinner size="md" />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('should apply large size', () => {
      render(<LoadingSpinner size="lg" />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    it('should apply custom className', () => {
      render(<LoadingSpinner className="custom-class" />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('custom-class');
    });

    it('should render with custom label', () => {
      render(<LoadingSpinner label="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
    });

    it('should have screen reader text', () => {
      render(<LoadingSpinner />);
      expect(screen.getByText('Loading')).toHaveClass('sr-only');
    });

    it('should use custom label for screen reader', () => {
      render(<LoadingSpinner label="Processing image" />);
      expect(screen.getByText('Processing image')).toBeInTheDocument();
    });

    it('should have no accessibility violations', async () => {
      const { container } = render(<LoadingSpinner />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Animation', () => {
    it('should have animation classes', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByTestId('loading-spinner');
      const svg = spinner.querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
    });
  });
});