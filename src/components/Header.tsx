import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, Globe, Shield, Lock, X, ArrowRight } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface HeaderProps {
  variant?: 'ivory' | 'staff';
}

export const Header: React.FC<HeaderProps> = ({ variant = 'ivory' }) => {
  const { language, toggleLanguage, t } = useTranslation();
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      setShowStaffModal(false);
      setPin('');
      setPinError(false);
      navigate('/reception');
    } else {
      setPinError(true);
    }
  };

  const isStaff = variant === 'staff';

  const headerBase = isStaff
    ? 'sticky top-0 z-40 bg-charcoal-900/95 backdrop-blur-md border-b border-charcoal-800'
    : scrolled
      ? 'sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ivory-200 shadow-warm'
      : 'sticky top-0 z-40 bg-ivory-50/80 backdrop-blur-md border-b border-ivory-200';

  return (
    <>
      <header className={`${headerBase} transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-4">

          {/* ── Logo & Brand ── */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            {/* Logo mark */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0">
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
                isStaff
                  ? 'bg-gradient-to-br from-gold-400 to-gold-600 text-charcoal-900'
                  : 'bg-gradient-to-br from-gold-500 to-gold-700 text-white'
              } shadow-gold`}>
                <Scissors className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={2} />
              </div>
            </div>

            {/* Text */}
            <div className="hidden xs:block">
              <span className={`font-display font-semibold text-lg leading-tight block ${
                isStaff ? 'text-ivory-100' : 'text-charcoal-900'
              }`}>
                {t('app_name')}
              </span>
              <span className="text-[10px] font-medium tracking-widest uppercase text-gold-500 block leading-none mt-0.5">
                {t('tagline')}
              </span>
            </div>
          </Link>

          {/* ── Right Controls ── */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all duration-200 cursor-pointer ${
                isStaff
                  ? 'bg-charcoal-800 border-charcoal-700 text-charcoal-300 hover:border-gold-500/50 hover:text-gold-400'
                  : 'bg-white border-ivory-200 text-charcoal-600 hover:border-gold-400 hover:text-gold-600 shadow-warm'
              }`}
              aria-label="Toggle language"
            >
              <Globe className="w-3.5 h-3.5 text-gold-500" />
              <span className={language === 'en' ? 'text-gold-500' : isStaff ? 'text-charcoal-400' : 'text-charcoal-400'}>EN</span>
              <span className={isStaff ? 'text-charcoal-700' : 'text-ivory-300'}>·</span>
              <span className={language === 'gu' ? 'text-gold-500' : isStaff ? 'text-charcoal-400' : 'text-charcoal-400'}>ગુ</span>
            </button>

            {/* Staff access */}
            <button
              onClick={() => setShowStaffModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                isStaff
                  ? 'bg-charcoal-800 border-charcoal-700 text-charcoal-300 hover:border-gold-500/50'
                  : 'bg-white border-ivory-200 text-charcoal-600 hover:border-gold-400 hover:text-charcoal-900 shadow-warm'
              }`}
              title="Staff PIN: 1234"
            >
              <Shield className="w-3.5 h-3.5 text-gold-500" />
              <span className="hidden sm:inline">{t('staff_portal')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────
          Staff PIN Modal
      ───────────────────────────────────────── */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-warm-xl animate-scaleIn overflow-hidden">

            {/* Modal header stripe */}
            <div className="h-1 w-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400" />

            <div className="p-6 sm:p-8">
              {/* Close */}
              <button
                onClick={() => { setShowStaffModal(false); setPin(''); setPinError(false); }}
                className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-charcoal-400 hover:text-charcoal-700 hover:bg-ivory-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-gold-100 border border-gold-200 flex items-center justify-center text-gold-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-charcoal-900 text-lg leading-tight">Staff Access</h3>
                  <p className="text-xs text-charcoal-400 mt-0.5">Default test PIN: <span className="font-mono font-bold text-gold-600">1234</span></p>
                </div>
              </div>

              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                    placeholder="• • • •"
                    className={`input-warm w-full text-center text-3xl tracking-[0.6em] py-4 font-mono ${pinError ? 'input-error' : ''}`}
                    autoFocus
                  />
                  {pinError && (
                    <p className="text-rose-500 text-xs mt-1.5 text-center font-medium">
                      Invalid PIN — use <span className="font-mono font-bold">1234</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="submit"
                    className="btn-gold text-sm py-3"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Enter
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowStaffModal(false); setPin(''); }}
                    className="btn-outline text-sm py-3"
                  >
                    Cancel
                  </button>
                </div>

                {/* Quick navigation links */}
                <div className="pt-3 border-t border-ivory-200">
                  <p className="section-label mb-2.5">Quick Screen Links</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      { to: '/reception', label: 'Reception Dashboard' },
                      { to: '/barber/Ravi', label: 'Stylist (Ravi)' },
                      { to: '/display', label: 'Waiting TV' },
                      { to: '/admin', label: 'Owner Settings' },
                    ].map(({ to, label }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setShowStaffModal(false)}
                        className="flex items-center gap-1.5 p-2 rounded-lg bg-ivory-50 hover:bg-gold-50 hover:text-gold-700 text-charcoal-500 font-medium transition-colors border border-transparent hover:border-gold-200"
                      >
                        <span className="text-gold-400">›</span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
