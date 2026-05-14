import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { isCRMStandaloneHost } from '../lib/crmRouting';

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

const CRM_SOURCES: Record<BrandLogoVariant, { light: string; dark: string }> = {
  mark: {
    light: '/brand/crm/logo-mark-light.png',
    dark: '/brand/crm/logo-mark-dark.png',
  },
  full: {
    light: '/brand/crm/logo-full-light.png',
    dark: '/brand/crm/logo-full-dark.png',
  },
};

function isCRMBrandContext(): boolean {
  if (typeof window === 'undefined') return false;
  return isCRMStandaloneHost(window.location.hostname) || window.location.hash === '#/crmplus' || window.location.hash.startsWith('#/crmplus/');
}

const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'mark', className, alt = 'iPhoneRepasse' }) => {
  const { resolvedTheme } = useTheme();
  const sources = isCRMBrandContext() ? CRM_SOURCES : SOURCES;
  const src = resolvedTheme === 'dark' ? sources[variant].dark : sources[variant].light;

  return <img src={src} alt={alt} className={className} />;
};

export default BrandLogo;
