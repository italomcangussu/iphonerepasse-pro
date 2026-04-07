import React, { useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';

/**
 * Subtle PDV sale-completed celebration overlay.
 *
 * - 12 particles emanating from center (radial spread).
 * - 800ms total fade-out duration.
 * - Honors prefers-reduced-motion (renders nothing).
 *
 * Per PRD US-021 / Q1 revision: "sutil" — restrained, not confetti chaos.
 */

const PARTICLE_COUNT = 12;
const PARTICLE_COLORS = [
  '#3b82f6', // brand-500
  '#34C759', // ios-green
  '#FF9500', // ios-orange
  '#AF52DE', // ios-purple
];

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    angle: (i / PARTICLE_COUNT) * Math.PI * 2,
    distance: 80 + Math.random() * 40,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    size: 6 + Math.random() * 4,
  }));
}

interface SaleCelebrationProps {
  /** When true, the celebration plays once and auto-removes. */
  show: boolean;
}

export const SaleCelebration: React.FC<SaleCelebrationProps> = ({ show }) => {
  const reducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[] | null>(null);

  useEffect(() => {
    if (show && !reducedMotion) {
      setParticles(makeParticles());
      const t = window.setTimeout(() => setParticles(null), 850);
      return () => window.clearTimeout(t);
    }
  }, [show, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible" aria-hidden="true">
      <AnimatePresence>
        {particles && particles.map((p) => (
          <m.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{
              x: Math.cos(p.angle) * p.distance,
              y: Math.sin(p.angle) * p.distance,
              opacity: 0,
              scale: 1,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.8,
              ease: [0.32, 0.72, 0, 1],
            }}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              borderRadius: '9999px',
              backgroundColor: p.color,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
