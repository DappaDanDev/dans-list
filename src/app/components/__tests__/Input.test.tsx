import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Input } from '../Input';

expect.extend(toHaveNoViolations);

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<Input label="Username" />);
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('should render with helper text', () => {
      render(<Input helperText="Enter your username" />);
      expect(screen.getByText('Enter your username')).toBeInTheDocument();
    });

    it('should render with error message', () => {
      render(<Input error="Username is required" />);
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should render as required field', () => {
      render(<Input label="Email" required />);
      expect(screen.getByLabelText(/Email \*/)).toBeInTheDocument();
    });
  });

  describe('Input Types', () => {
    it('should render text input by default', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
    });

    it('should render email input', () => {
      render(<Input type="email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('should render password input', () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText('Password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should render number input', () => {
      render(<Input type="number" />);
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
    });

    it('should render search input', () => {
      render(<Input type="search" />);
      expect(screen.getByRole('searchbox')).toHaveAttribute('type', 'search');
    });

    it('should render textarea when multiline', () => {
      render(<Input multiline rows={4} />);
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    });
  });

  describe('Interactions', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<Input onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');

      expect(input).toHaveValue('Hello');
      expect(handleChange).toHaveBeenCalledTimes(5); // Once for each character
    });

    it('should handle blur event', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(<Input onBlur={handleBlur} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab();

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should handle focus event', async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();

      render(<Input onFocus={handleFocus} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when specified', () => {
      render(<Input disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should be readonly when specified', () => {
      render(<Input readOnly value="Read only" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveValue('Read only');
    });
  });

  describe('Icons', () => {
    it('should render with left icon', () => {
      const Icon = () => <span data-testid="left-icon">🔍</span>;

      render(<Input leftIcon={<Icon />} />);

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('should render with right icon', () => {
      const Icon = () => <span data-testid="right-icon">✓</span>;

      render(<Input rightIcon={<Icon />} />);

      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error state', () => {
      render(<Input error="Invalid input" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should support pattern validation', () => {
      render(<Input pattern="[0-9]*" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('pattern', '[0-9]*');
    });

    it('should support min length validation', () => {
      render(<Input minLength={3} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('minLength', '3');
    });

    it('should support max length validation', () => {
      render(<Input maxLength={10} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '10');
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Input label="Accessible Input" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should associate label with input', () => {
      render(<Input label="Email Address" />);

      const input = screen.getByLabelText('Email Address');
      expect(input).toBeInTheDocument();
    });

    it('should have aria-describedby for helper text', () => {
      render(<Input helperText="Enter valid email" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby');

      const helperId = input.getAttribute('aria-describedby');
      const helperElement = document.getElementById(helperId!);
      expect(helperElement).toHaveTextContent('Enter valid email');
    });

    it('should have aria-describedby for error text', () => {
      render(<Input error="Email is invalid" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should be focusable', async () => {
      const user = userEvent.setup();
      render(<Input />);

      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();
    });
  });
});