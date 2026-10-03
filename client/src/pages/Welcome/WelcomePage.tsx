import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FilmTitle, ClassifiedStamp } from '../../components/Brand';
import { Button } from '../../components/Button';
import { FadeIn } from '../../components/ui';

const EVIDENCE_MARKS = [
  { label: 'Case', value: 'SF-001' },
  { label: 'Status', value: 'Open' },
  { label: 'Clearance', value: 'Level 3' },
];

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mb-10"
      >
        <ClassifiedStamp label="Classified · Interactive Investigation" />
      </motion.div>

      <FilmTitle />

      <FadeIn delay={0.95}>
        <p className="mt-10 text-center font-mono text-sm uppercase tracking-[0.3em] text-mist sm:text-base">
          Every crime reveals a clue.
        </p>
      </FadeIn>

      <FadeIn delay={1.2} y={22}>
        <div className="mt-12">
          <Button
            size="lg"
            onClick={() => navigate('/code')}
            className="relative overflow-hidden px-14"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14m-6-6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            <span className="relative z-10">Enter Code</span>
            {/* Sheen sweep on hover */}
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 hover:translate-x-full"
            />
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={1.5}>
        <dl className="mt-16 grid w-full max-w-lg grid-cols-3 gap-3 sm:gap-6">
          {EVIDENCE_MARKS.map((mark) => (
            <div key={mark.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-center">
              <dt className="label-caps">{mark.label}</dt>
              <dd className="mt-1.5 font-mono text-xs text-white sm:text-sm">{mark.value}</dd>
            </div>
          ))}
        </dl>
      </FadeIn>
    </div>
  );
};

export default WelcomePage;