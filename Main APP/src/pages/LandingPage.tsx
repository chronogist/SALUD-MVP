import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserStore } from '@/store';
import './LandingPage.css';

// --- Icons ---

function PatientIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function DoctorIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

// --- Animation variants ---
const fadeIn = (delay: number) => ({
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
});

const cardHover = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

export function LandingPage() {
  const navigate = useNavigate();
  const { setRole } = useUserStore();

  const handleSelect = (role: 'patient' | 'doctor') => {
    setRole(role);
    navigate(role === 'patient' ? '/overview' : '/doctor');
  };

  return (
    <div className="lp-wrapper">
      {/* Background glows */}
      <div className="lp-bg-glow lp-bg-glow-blue" />
      <div className="lp-bg-glow lp-bg-glow-purple" />

      {/* Logo */}
      <motion.div className="lp-brand" variants={fadeIn(0)} initial="hidden" animate="visible">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L12 22M2 12L22 12M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="#111112" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span>Salud Healths</span>
      </motion.div>

      {/* Heading */}
      <motion.div className="lp-heading" variants={fadeIn(0.15)} initial="hidden" animate="visible">
        <h1>How are you using Salud?</h1>
        <p>Select your role to get started with secure, blockchain-powered health records</p>
      </motion.div>

      {/* Role Cards */}
      <div className="lp-cards">
        <motion.div
          className="lp-card lp-card-patient"
          custom={0.3}
          variants={cardHover}
          initial="hidden"
          animate="visible"
          onClick={() => handleSelect('patient')}
        >
          <div className="lp-card-icon">
            <PatientIcon />
          </div>
          <h2>I'm a Patient</h2>
          <p>Store, manage, and share your medical records securely on the blockchain</p>
          <div className="lp-card-arrow">
            <ArrowRightIcon />
          </div>
        </motion.div>

        <motion.div
          className="lp-card lp-card-doctor"
          custom={0.45}
          variants={cardHover}
          initial="hidden"
          animate="visible"
          onClick={() => handleSelect('doctor')}
        >
          <div className="lp-card-icon">
            <DoctorIcon />
          </div>
          <h2>I'm a Doctor</h2>
          <p>Scan patient QR codes to securely access shared medical records</p>
          <div className="lp-card-arrow">
            <ArrowRightIcon />
          </div>
        </motion.div>
      </div>

      {/* Footer badge */}
      <motion.div className="lp-footer" variants={fadeIn(0.6)} initial="hidden" animate="visible">
        <div className="lp-footer-badge">
          <ShieldCheckIcon />
          Secured by Aleo Zero-Knowledge Proofs
        </div>
        <p className="lp-footer-text">Your data never leaves your wallet</p>
      </motion.div>
    </div>
  );
}
