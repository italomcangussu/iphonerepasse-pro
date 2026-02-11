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
    // Light theme uses darker strokes.
    light: '/brand/logo-mark-dark.svg',
    // Dark theme uses lighter strokes.
    dark: '/brand/logo-mark-light.svg',
  },
  full: {
    // Light theme version (dark text/details).
    light: '/brand/logo-full-dark.svg',
    // Dark theme version (light text/details).
    dark: '/brand/logo-full-light.svg',
  },
};

const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'mark', className, alt = 'iPhoneRepasse' }) => {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'dark' ? SOURCES[variant].dark : SOURCES[variant].light;

  return <img src={src} alt={alt} className={className} />;
};

export default BrandLogo;
