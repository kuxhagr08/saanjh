import React from 'react';

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

/**
 * Shared AppContainer for APNA.
 * Ensures header, main page shells, and content views share
 * the exact same responsive max-width, centering, and gutter padding.
 * Guarantees zero layout clipping or horizontal overflow.
 */
export const AppContainer: React.FC<AppContainerProps> = ({
  children,
  className = '',
  noPadding = false,
}) => {
  return (
    <div
      className={`w-full max-w-6xl mx-auto min-w-0 ${
        noPadding ? '' : 'px-3 sm:px-4 md:px-6'
      } ${className}`}
    >
      {children}
    </div>
  );
};
