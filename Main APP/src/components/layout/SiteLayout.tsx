import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/store';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { truncateAddress, copyToClipboard } from '@/lib/utils';
import { WalletConnectModal } from './WalletConnectModal';

const slideIn = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (delay: number) => ({
    opacity: 1,
    transition: { delay, duration: 0.8, ease: 'easeOut' as const },
  }),
};

const navLinks = [
  { label: 'Overview', to: '/overview' },
  { label: 'Medical Records', to: '/records' },
  { label: 'Doctors', to: '/shared' },
  { label: 'Insights', to: '/settings' },
];

// --- Icons ---

function WalletIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface SiteLayoutProps {
  children: React.ReactNode;
  mainClassName?: string;
}

export function SiteLayout({ children, mainClassName }: SiteLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const user = useUserStore((state) => state.user);
  const { disconnect: disconnectUser, setRole } = useUserStore();
  const { disconnect: disconnectWallet } = useWallet();

  const handleSwitchRole = () => {
    const newRole = user?.role === 'doctor' ? 'patient' : 'doctor';
    setRole(newRole);
    setShowDropdown(false);
    navigate(newRole === 'doctor' ? '/doctor' : '/overview');
  };

  const handleCopyAddress = async () => {
    if (!user?.address) return;
    const success = await copyToClipboard(user.address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
    } catch (err) {
      console.warn('[SiteLayout] Wallet disconnect error:', err);
    }
    disconnectUser();
    setShowDropdown(false);
  };

  // Show connect bubble when not connected
  useEffect(() => {
    if (!user?.isConnected) {
      bubbleTimerRef.current = setTimeout(() => setShowBubble(true), 2000);
    } else {
      setShowBubble(false);
    }
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [user?.isConnected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="hp-wrapper">
      <header className="hp-header">
        <Link to="/overview" className="hp-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L12 22M2 12L22 12M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="#111112" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Salud Healths
        </Link>
        <nav className="hp-main-nav hp-desktop-nav">
          {navLinks.map((link, i) => (
            <motion.div key={link.label} custom={i + 1} initial="hidden" animate="visible" variants={slideIn}>
              <Link to={link.to} className={location.pathname === link.to ? 'active' : ''}>
                {link.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        {/* Right side: profile + hamburger */}
        <div className="hp-header-right">
        {/* Profile / Wallet Area */}
        <motion.div
          className="hp-profile-area"
          custom={0.3}
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          ref={dropdownRef}
        >
          {/* Connect wallet bubble */}
          <AnimatePresence>
            {showBubble && !user?.isConnected && !showDropdown && (
              <motion.div
                className="sl-bubble"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                onClick={() => {
                  setShowBubble(false);
                  setShowDropdown(true);
                }}
              >
                <span className="sl-bubble-emoji">👋</span>
                <span className="sl-bubble-text">Hey! Connect your wallet to get started</span>
                <span className="sl-bubble-tail" />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            className="hp-user-profile"
            onClick={() => {
              setShowBubble(false);
              setShowDropdown(!showDropdown);
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150"
              alt="User profile"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className={`hp-status-dot ${user?.isConnected ? 'connected' : ''}`} />
          </button>

          {/* Wallet Dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                className="sl-dropdown"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {user?.isConnected ? (
                  <>
                    {/* Connected status */}
                    <div className="sl-dropdown-header">
                      <div className="sl-wallet-icon">
                        <WalletIcon />
                      </div>
                      <div>
                        <p className="sl-connected-label">Connected</p>
                        <span className="sl-network-badge">Aleo Testnet</span>
                      </div>
                    </div>

                    {/* Wallet address */}
                    <div className="sl-address-block">
                      <p className="sl-address-label">Wallet Address</p>
                      <div className="sl-address-row">
                        <code className="sl-address-value">
                          {truncateAddress(user.address, 20, 6)}
                        </code>
                        <button className="sl-copy-btn" onClick={handleCopyAddress}>
                          {copied ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="sl-dropdown-actions">
                      <a
                        href={`https://explorer.aleo.org/address/${user.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sl-action-link"
                      >
                        <ExternalLinkIcon />
                        View on Explorer
                      </a>

                      <button className="sl-switch-btn" onClick={handleSwitchRole}>
                        <SwitchIcon />
                        {user.role === 'doctor' ? 'Switch to Patient' : 'Switch to Doctor'}
                      </button>

                      <button className="sl-disconnect-btn" onClick={handleDisconnect}>
                        <LogOutIcon />
                        Disconnect Wallet
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Not connected state */}
                    <div className="sl-dropdown-header">
                      <div className="sl-wallet-icon sl-wallet-icon-gray">
                        <WalletIcon />
                      </div>
                      <div>
                        <p className="sl-connected-label">No Wallet Connected</p>
                        <p className="sl-subtitle-text">Connect to access all features</p>
                      </div>
                    </div>

                    <button
                      className="sl-connect-btn"
                      onClick={() => {
                        setShowDropdown(false);
                        setShowConnectModal(true);
                      }}
                    >
                      <WalletIcon />
                      Connect Wallet
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Hamburger button — mobile only */}
        <button
          className="hp-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="hp-mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.nav
              className="hp-mobile-drawer"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`hp-mobile-link${location.pathname === link.to ? ' active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
      <main className={mainClassName || 'hp-main'}>
        {children}
      </main>

      {/* Wallet Connect Modal */}
      <WalletConnectModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
      />
    </div>
  );
}
