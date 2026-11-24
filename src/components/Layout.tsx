import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  variant?: 'ivory' | 'staff';
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  hideHeader = false,
  variant = 'ivory',
}) => {
  return (
    <div
      className={
        variant === 'staff'
          ? 'min-h-screen bg-charcoal-900 text-ivory-100 flex flex-col font-sans'
          : 'min-h-screen bg-ivory-50 text-charcoal-900 flex flex-col font-sans'
      }
    >
      {!hideHeader && <Header variant={variant} />}
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
};
