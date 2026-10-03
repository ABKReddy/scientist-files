import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  accent: 'red' | 'blue' | 'white';
}

/**
 * Canvas particle field — drifting dust plus faint connection lines.
 * Honours `prefers-reduced-motion` by drawing a single static frame.
 */
export const ParticleField = ({ density = 0.00007 }: { density?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let particles: Particle[] = [];
    let animationFrame = 0;
    let width = 0;
    let height = 0;

    const COLORS: Record<Particle['accent'], string> = {
      red: 'rgba(255,45,85,0.55)',
      blue: 'rgba(61,123,255,0.55)',
      white: 'rgba(255,255,255,0.32)',
    };

    const seed = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.min(110, Math.floor(width * height * density));
      particles = Array.from({ length: count }, () => {
        const roll = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          radius: Math.random() * 1.6 + 0.5,
          accent: roll > 0.88 ? 'red' : roll > 0.72 ? 'blue' : 'white',
        };
      });
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
        }

        context.beginPath();
        context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        context.fillStyle = COLORS[p.accent];
        context.fill();

        // Thin links between nearby particles — the "surveillance grid" look.
        for (let j = i + 1; j < particles.length; j += 1) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 128) {
            context.beginPath();
            context.moveTo(p.x, p.y);
            context.lineTo(q.x, q.y);
            context.strokeStyle = `rgba(120,150,220,${0.09 * (1 - distance / 128)})`;
            context.lineWidth = 1;
            context.stroke();
          }
        }
      }
    };

    const loop = () => {
      draw();
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(loop);
    };

    seed();
    draw();
    if (!reducedMotion) animationFrame = window.requestAnimationFrame(loop);

    const handleResize = () => {
      seed();
      draw();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
    />
  );
};

export const Backdrop = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-void" />
    <ParticleField />
    <div className="grid-overlay absolute inset-0" />
    <div className="absolute inset-x-0 top-0 h-64 bg-radial-red" />
    <div className="absolute inset-x-0 bottom-0 h-72 bg-radial-blue" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(4,5,10,0.85)_100%)]" />
    <div className="absolute inset-x-0 top-0 h-px animate-scan-line bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
  </div>
);