import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useId } from 'react';

interface BaseInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
}

export type InputProps = BaseInputProps &
  (
    | ({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>)
    | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)
  );

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      multiline = false,
      rows = 3,
      required,
      className = '',
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    // Base input styles
    const baseInputStyles = `
      block w-full rounded-md shadow-sm
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      transition-colors duration-200
    `;

    // Border and focus styles based on error state
    const borderStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

    // Padding adjustments for icons
    const paddingStyles = `
      ${leftIcon ? 'pl-10' : 'pl-3'}
      ${rightIcon ? 'pr-10' : 'pr-3'}
      py-2
    `;

    const inputClassName = `
      ${baseInputStyles}
      ${borderStyles}
      ${paddingStyles}
      ${className}
    `.replace(/\s+/g, ' ').trim();

    const ariaProps = {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : helperText ? helperId : undefined,
    };

    const sharedProps = {
      id: inputId,
      className: inputClassName,
      ...ariaProps,
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">{leftIcon}</span>
            </div>
          )}

          {multiline ? (
            <textarea
              {...sharedProps}
              {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
              ref={ref as any}
              rows={rows}
            />
          ) : (
            <input
              {...sharedProps}
              {...(props as InputHTMLAttributes<HTMLInputElement>)}
              ref={ref as any}
              type={props.type || 'text'}
            />
          )}

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500">{rightIcon}</span>
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';