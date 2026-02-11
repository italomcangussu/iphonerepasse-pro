import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

type BrandLogoVariant = 'mark' | 'full';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  alt?: string;
}

const SOURCES: Record<BrandLogoVariant, { light: string; dark: string }> = {
  mark: {
    // Official light-theme mark (dark strokes).
    light: '/brand/logo-mark-light.png',
    // Official dark-theme mark (white strokes).
    dark: '/brand/logo-mark-dark.png',
  },
  full: {
    // Official light-theme full logo.
    light: '/brand/logo-full-light.png',
    // Official dark-theme full logo.
    dark: '/brand/logo-full-dark.png',
  },
};

const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'mark', className, alt = 'iPhoneRepasse' }) => {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'dark' ? SOURCES[variant].dark : SOURCES[variant].light;

  return <img src={src} alt={alt} className={className} />;
};

export default BrandLogo;
