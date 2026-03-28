import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import './HomePage.css';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.8, ease: 'easeOut' },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (delay: number) => ({
    opacity: 1,
    transition: { delay, duration: 0.8, ease: 'easeOut' },
  }),
};

// --- Icon Components ---
function ArrowUpIcon() {
  return (
    <svg className="hp-icon-arrow-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="hp-icon-arrow-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function HeartbeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// --- Sub-components ---

function MetricCard({
  title,
  value,
  badge,
  badgeDirection,
  theme,
  fillWidth,
  description,
  large = false,
  index = 0,
}: {
  title: string;
  value: string;
  badge: string;
  badgeDirection: 'up' | 'down';
  theme: string;
  fillWidth: string;
  description?: React.ReactNode;
  large?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      className={`hp-card hp-theme-${theme}`}
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      <div className="hp-card-header">
        <span className="hp-card-title">{title}</span>
        <div className="hp-badge">
          {badgeDirection === 'up' ? <ArrowUpIcon /> : <ArrowDownIcon />}
          {badge}
        </div>
      </div>
      <div className="hp-indicator-track">
        <div className="hp-indicator-fill" style={{ width: fillWidth }} />
      </div>
      <div className={`hp-data-value${large ? '' : ' medium'}`}>{value}</div>
      {description && <p className="hp-data-description">{description}</p>}
    </motion.div>
  );
}

function RecordCard({
  image,
  imageStyle,
  icon,
  day,
  month,
  title,
  doctor,
  bgStyle,
  index = 0,
}: {
  image?: string;
  imageStyle?: React.CSSProperties;
  icon: React.ReactNode;
  day: string;
  month: string;
  title: string;
  doctor: string;
  bgStyle?: React.CSSProperties;
  index?: number;
}) {
  return (
    <motion.a
      href="#"
      className="hp-record-card"
      style={bgStyle}
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      {image ? (
        <img src={image} alt={title} className="hp-record-bg" />
      ) : (
        <div className="hp-record-bg" style={imageStyle} />
      )}
      <div className="hp-record-top">
        <div className="hp-record-icon">{icon}</div>
        <div className="hp-record-date-badge">
          <span>{day}</span>
          {month}
        </div>
      </div>
      <div className="hp-record-bottom">
        <div className="hp-record-title">{title}</div>
        <div className="hp-record-doctor">{doctor}</div>
      </div>
    </motion.a>
  );
}

// --- Main Homepage Component ---

export function HomePage() {
  return (
    <SiteLayout>
        {/* Vitals Overview */}
        <section className="hp-section">
          <motion.h2 initial="hidden" animate="visible" variants={fadeInUp} custom={0}>
            Vitals Overview
          </motion.h2>

          <div className="hp-metrics-layout">
            {/* Large card */}
            <MetricCard
              title="Overall Health Index"
              value="88"
              badge="+4 pts"
              badgeDirection="up"
              theme="blue"
              fillWidth="88%"
              large
              index={1}
              description={
                <>
                  Your composite health score based on recent lab results and wearable data. Routine bloodwork indicates positive trends. Shared securely with <strong>Dr. Aris</strong>.
                </>
              }
            />

            {/* Small metrics grid */}
            <div className="hp-small-metrics">
              <MetricCard
                title="Blood Pressure"
                value="110/70"
                badge="-2%"
                badgeDirection="down"
                theme="blue"
                fillWidth="60%"
                index={2}
              />
              <MetricCard
                title="Resting Heart Rate"
                value="62"
                badge="-4 bpm"
                badgeDirection="down"
                theme="green"
                fillWidth="45%"
                index={3}
              />
              <MetricCard
                title="Cholesterol (LDL)"
                value="95"
                badge="-12 mg"
                badgeDirection="down"
                theme="pink"
                fillWidth="75%"
                index={4}
              />
              <MetricCard
                title="Sleep Average"
                value="7h 20"
                badge="+45m"
                badgeDirection="up"
                theme="purple"
                fillWidth="85%"
                index={5}
              />
            </div>
          </div>
        </section>

        {/* Active Data Shares */}
        <section className="hp-section">
          <div className="hp-section-header">
            <motion.h2 initial="hidden" animate="visible" variants={fadeInUp} custom={0}>
              Active Data Shares
            </motion.h2>
            <motion.div className="hp-controls" custom={0.2} initial="hidden" animate="visible" variants={fadeIn}>
              <button className="hp-btn-icon">
                <ChevronLeft size={16} />
              </button>
              <button className="hp-btn-icon">
                <ChevronRight size={16} />
              </button>
            </motion.div>
          </div>

          <div className="hp-records-grid">
            <RecordCard
              image="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=600"
              icon={<FileIcon />}
              day="14"
              month="Oct"
              title="Q3 Blood Panel"
              doctor="Shared with Dr. Chen"
              index={1}
            />
            <RecordCard
              image="https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&q=80&w=600"
              icon={<HeartbeatIcon />}
              day="02"
              month="Nov"
              title="ECG Results"
              doctor="Shared with Dr. Miller"
              index={2}
            />
            <RecordCard
              image="https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&q=80&w=600"
              icon={<ImageIcon />}
              day="28"
              month="Nov"
              title="MRI Scan Images"
              doctor="Shared with Dr. Aris"
              index={3}
            />
            <RecordCard
              icon={<ShieldIcon />}
              day="15"
              month="Dec"
              title="Vaccination History"
              doctor="General Access"
              bgStyle={{ background: '#EAEAF2' }}
              imageStyle={{ background: 'linear-gradient(135deg, #A8B8D8 0%, #8A9BB8 100%)', mixBlendMode: 'multiply' as const }}
              index={4}
            />
          </div>
        </section>
    </SiteLayout>
  );
}
