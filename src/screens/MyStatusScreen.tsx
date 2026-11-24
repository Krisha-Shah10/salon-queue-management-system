import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore, cancelTicketApi } from '../services/queueStore';
import {
  calculateIndividualWaitTime,
  calculateTotalDuration,
  calculateTotalPrice
} from '../services/queueRules';
import {
  ArrowLeft,
  Clock,
  Sparkles,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  User,
  X,
  Volume2,
  Home,
  AlertCircle,
  Coffee
} from 'lucide-react';

// Play sound chime function using Web Audio API (zero external asset dependency)
function playArrivalChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // Tone 1 (High chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2 (Lower harmonic chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.2); // A5
    gain2.gain.setValueAtTime(0.3, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn('Audio chime playback blocked or not supported:', e);
  }
}

export const MyStatusScreen: React.FC = () => {
  const { id: paramId } = useParams<{ id: string }>();
  const { t, language } = useTranslation();
  const [salonState] = useQueueStore();
  const navigate = useNavigate();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [chimePlayed, setChimePlayed] = useState(false);
  const [turnAcknowledged, setTurnAcknowledged] = useState(false);

  // Active Token ID resolution (from URL or fallback to localStorage)
  const tokenId = useMemo(() => {
    if (paramId && paramId !== ':id') return paramId;
    return typeof window !== 'undefined' ? localStorage.getItem('salon_active_token') : null;
  }, [paramId]);

  // Find ticket from reactive queueStore
  const currentTicket = useMemo(() => {
    if (!tokenId) return null;
    return salonState.tickets.find(t => t.id.toLowerCase() === tokenId.toLowerCase()) || null;
  }, [tokenId, salonState.tickets]);

  // Active waiting queue (FIFO)
  const waitingTickets = useMemo(() => {
    return salonState.tickets.filter(t => t.status === 'Waiting');
  }, [salonState.tickets]);

  // Current customer's numeric position in line (1-based)
  const queuePosition = useMemo(() => {
    if (!currentTicket || currentTicket.status !== 'Waiting') return null;
    const index = waitingTickets.findIndex(t => t.id === currentTicket.id);
    return index >= 0 ? index + 1 : null;
  }, [currentTicket, waitingTickets]);

  // Real-time estimated wait time calculation
  const estimatedWaitMinutes = useMemo(() => {
    if (!currentTicket) return 0;
    if (currentTicket.status === 'Called' || currentTicket.status === 'In chair') return 0;
    return calculateIndividualWaitTime(
      salonState.tickets,
      salonState.barbers,
      currentTicket.preferredBarberId,
      currentTicket.id
    );
  }, [currentTicket, salonState.tickets, salonState.barbers]);

  // Preferred or Assigned Barber object
  const assignedBarber = useMemo(() => {
    if (!currentTicket) return null;
    const bId = currentTicket.assignedBarberId || (currentTicket.preferredBarberId !== 'any' ? currentTicket.preferredBarberId : null);
    if (!bId) return null;
    return salonState.barbers.find(b => b.id === bId) || null;
  }, [currentTicket, salonState.barbers]);

  // Total service duration and price
  const totalDuration = useMemo(() => {
    return currentTicket ? calculateTotalDuration(currentTicket.services) : 0;
  }, [currentTicket]);

  const totalPrice = useMemo(() => {
    return currentTicket ? calculateTotalPrice(currentTicket.services) : 0;
  }, [currentTicket]);

  // Live countdown timer for Called arrival grace period (10 minutes)
  const [nowTime, setNowTime] = useState(() => Date.now());
  useEffect(() => {
    if (currentTicket?.status === 'Called') {
      const interval = setInterval(() => setNowTime(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [currentTicket?.status]);

  const graceCountdownStr = useMemo(() => {
    if (!currentTicket?.calledAt) return '10:00';
    const calledTime = new Date(currentTicket.calledAt).getTime();
    const elapsedSec = Math.floor((nowTime - calledTime) / 1000);
    const remainSec = Math.max(0, 600 - elapsedSec);
    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, [currentTicket?.calledAt, nowTime]);

  // Audio & Vibration Alert when status transitions to 'Called'
  useEffect(() => {
    if (currentTicket?.status === 'Called' && !chimePlayed) {
      playArrivalChime();
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200, 100, 300]);
        } catch (_) {}
      }
      setChimePlayed(true);
    }
  }, [currentTicket?.status, chimePlayed]);

  // Handle Cancellation Action
  const handleConfirmCancel = async () => {
    if (!currentTicket) return;
    setIsCancelling(true);
    try {
      await cancelTicketApi(currentTicket.id);
      localStorage.removeItem('salon_active_token');
      setShowCancelModal(false);
      setIsCancelling(false);
    } catch (err) {
      console.error('Failed to cancel spot:', err);
      setIsCancelling(false);
    }
  };

  // Helper for ordinal suffix
  const getOrdinal = (n: number) => {
    if (language === 'gu') return `${n}મા`;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // If ticket is not found in system
  if (!currentTicket) {
    return (
      <Layout>
        <div className="max-w-md mx-auto w-full px-4 py-16 flex flex-col items-center text-center animate-slideUp">
          <div className="bg-white border border-ivory-200 rounded-3xl shadow-warm-lg p-8 w-full flex flex-col items-center space-y-6 relative overflow-hidden">
            {/* Top gold bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600"></div>

            <div className="w-16 h-16 rounded-full bg-ivory-100 border border-ivory-200 flex items-center justify-center text-gold-500 shadow-inner-warm">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold text-charcoal-900">
                {t('ticket_not_found_title')}
              </h1>
              <p className="text-xs text-charcoal-600 max-w-xs leading-relaxed">
                {t('ticket_not_found_body', { token: tokenId || '—' })}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <Link
                to="/join"
                className="w-full py-3 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-gold transition-colors"
              >
                <span>{t('join_new_queue')}</span>
              </Link>
              <Link
                to="/"
                className="w-full py-3 px-4 rounded-xl bg-ivory-100 hover:bg-ivory-200 text-charcoal-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-ivory-200 transition-colors"
              >
                <Home className="w-4 h-4 text-charcoal-500" />
                <span>{t('return_home')}</span>
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // --- FULL SCREEN GOLD TAKEOVER: "IT'S YOUR TURN!" (When Status === 'Called') ---
  if (currentTicket.status === 'Called' && !turnAcknowledged) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gold-400 via-gold-500 to-amber-500 text-charcoal-950 flex flex-col justify-between p-6 sm:p-8 animate-fadeIn">
        {/* Top Header inside Gold Modal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-charcoal-950 text-gold-400 flex items-center justify-center shadow">
              <Scissors className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xs uppercase tracking-wider text-charcoal-950">
              {t('app_name')}
            </span>
          </div>

          <button
            onClick={playArrivalChime}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-charcoal-950/10 hover:bg-charcoal-950/20 border border-charcoal-950/20 text-xs font-bold text-charcoal-950 transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Play Chime</span>
          </button>
        </div>

        {/* Center Calling Message */}
        <div className="my-auto text-center space-y-6 max-w-md mx-auto w-full py-6">
          {/* Animated Pulsing Icon */}
          <div className="w-24 h-24 mx-auto rounded-3xl bg-charcoal-950 text-gold-400 flex items-center justify-center shadow-2xl animate-bounce">
            <Scissors className="w-12 h-12 stroke-[2.5]" />
          </div>

          <div className="space-y-3">
            <div className="inline-block px-5 py-1.5 rounded-full bg-charcoal-950 text-gold-400 font-display font-bold text-base tracking-widest uppercase shadow-md">
              {currentTicket.id}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-charcoal-950 tracking-tight leading-tight">
              {t('its_your_turn_banner')}
            </h1>
          </div>

          {/* Station Instruction */}
          <div className="p-6 rounded-2xl bg-charcoal-950/10 border border-charcoal-950/15 space-y-2 backdrop-blur-sm shadow-inner">
            <p className="text-lg font-bold text-charcoal-950">
              {t('proceed_to_chair_inst', {
                barber: assignedBarber ? assignedBarber.name : 'Amit',
                station: assignedBarber ? assignedBarber.station : 2
              })}
            </p>
            <p className="text-xs font-semibold text-charcoal-900">
              {t('grace_period_countdown', { time: `${graceCountdownStr} min` })}
            </p>
          </div>
        </div>

        {/* Bottom Acknowledge CTA */}
        <div className="max-w-md mx-auto w-full pt-4">
          <button
            onClick={() => setTurnAcknowledged(true)}
            className="w-full min-h-[52px] py-4 rounded-2xl bg-charcoal-950 hover:bg-charcoal-900 text-white font-extrabold text-base shadow-xl active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{t('acknowledge_turn_btn')}</span>
            <CheckCircle2 className="w-5 h-5 text-gold-400" />
          </button>
        </div>
      </div>
    );
  }

  // --- NORMAL SCREEN 3 (MY STATUS) ---
  return (
    <Layout>
      <div className="max-w-lg mx-auto w-full px-4 py-6 pb-20 flex flex-col gap-6 animate-slideUp">

        {/* Top Back Link & Status Pulse */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-600 hover:text-gold-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back_home')}</span>
          </Link>

          <span className="text-[11px] text-charcoal-400 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Sync</span>
          </span>
        </div>

        {/* Token Identity Card */}
        <div className="bg-white border border-ivory-200 rounded-3xl p-6 shadow-warm-lg relative overflow-hidden">
          {/* Thin gold top-bar accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600"></div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] text-charcoal-400 uppercase tracking-widest font-semibold block">
                {t('your_token')}
              </span>
              <div className="font-display text-5xl font-bold text-gold-500 tracking-tight">
                {currentTicket.id}
              </div>
              <h2 className="text-xl font-semibold text-charcoal-900 pt-1">
                {currentTicket.customerName}
              </h2>
              <p className="text-xs text-charcoal-400 font-mono">
                +91 {currentTicket.phone.slice(0, 5)}*****
              </p>
            </div>

            {/* Stylist Pill */}
            <div className="text-right space-y-1.5 shrink-0">
              <span className="text-[11px] text-charcoal-400 block font-medium uppercase tracking-wider">
                Stylist
              </span>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ivory-100 border border-ivory-200 text-xs font-semibold text-gold-600 shadow-inner-warm">
                <User className="w-3.5 h-3.5 text-gold-600" />
                <span className="max-w-[120px] truncate">
                  {assignedBarber ? assignedBarber.name : t('barber_any')}
                </span>
              </div>
            </div>
          </div>

          {/* Selected Services Summary */}
          <div className="mt-6 pt-4 border-t border-ivory-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {currentTicket.services.map((s) => (
                <span
                  key={s.id}
                  className="bg-ivory-100 border border-ivory-200 rounded-lg px-2.5 py-1 text-xs text-charcoal-700 font-medium"
                >
                  {language === 'gu' ? s.nameGu : s.name} ({s.durationMinutes}m)
                </span>
              ))}
            </div>
            <div className="text-right text-charcoal-600 font-medium text-xs ml-auto">
              <span>{totalDuration}m · </span>
              <span className="text-gold-600 font-bold">₹{totalPrice}</span>
            </div>
          </div>
        </div>

        {/* Stylist on Break Notice (Section 6.2) */}
        {currentTicket.status === 'Waiting' && assignedBarber && assignedBarber.status === 'On Break' && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-warm flex items-start gap-3">
            <Coffee className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">{t('on_break')}</p>
              <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                {t('stylist_on_break_notice', { barber: assignedBarber.name })}
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Milestone Alert Banners */}
        {/* Banner 1: Threshold Alert when 2nd in line */}
        {queuePosition === 2 && currentTicket.status === 'Waiting' && (
          <div className="bg-amber-50 border border-amber-500 rounded-2xl p-4 shadow-warm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-700 leading-snug">
                {t('start_coming_banner')}
              </p>
            </div>
          </div>
        )}

        {/* Banner 2: Called State (If acknowledged takeover was dismissed) */}
        {currentTicket.status === 'Called' && (
          <div className="bg-gold-50 border-2 border-gold-500 rounded-2xl p-4 shadow-warm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-100 border border-gold-300 text-gold-600 flex items-center justify-center font-bold shadow-sm shrink-0">
                <Scissors className="w-5 h-5 text-gold-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gold-700">{t('its_your_turn_banner')}</p>
                <p className="text-xs text-charcoal-600 mt-0.5">
                  {t('proceed_to_chair_inst', {
                    barber: assignedBarber ? assignedBarber.name : 'Amit',
                    station: assignedBarber ? assignedBarber.station : 2
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner 3: In Chair State */}
        {currentTicket.status === 'In chair' && (
          <div className="bg-emerald-50 border border-emerald-500 rounded-2xl p-4 shadow-warm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Scissors className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-emerald-700">
              {t('in_chair_banner', { barber: assignedBarber ? assignedBarber.name : 'Ravi' })}
            </p>
          </div>
        )}

        {/* Banner 4: Done State */}
        {currentTicket.status === 'Done' && (
          <div className="bg-white border border-ivory-200 rounded-2xl p-6 text-center space-y-4 shadow-warm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-charcoal-900 text-lg">
                {t('service_done_banner')}
              </h3>
            </div>
            <Link
              to="/"
              onClick={() => localStorage.removeItem('salon_active_token')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-white font-semibold text-xs shadow-gold transition-colors"
            >
              <span>{t('return_home')}</span>
            </Link>
          </div>
        )}

        {/* Banner 5: Cancelled State */}
        {currentTicket.status === 'Cancelled' && (
          <div className="bg-white border border-ivory-200 rounded-2xl p-6 text-center space-y-4 shadow-warm">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-500">
              <AlertCircle className="w-7 h-7 text-rose-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-charcoal-900 text-lg">
                {t('spot_cancelled_banner')}
              </h3>
            </div>
            <Link
              to="/"
              onClick={() => localStorage.removeItem('salon_active_token')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ivory-100 hover:bg-ivory-200 text-charcoal-700 font-semibold text-xs border border-ivory-300 transition-colors"
            >
              <span>{t('return_home')}</span>
            </Link>
          </div>
        )}

        {/* Banner 6: No-Show State (Section 5.1 & Flow 1) */}
        {currentTicket.status === 'No-show' && (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-4 shadow-warm">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-500">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-charcoal-900 text-lg">
                {t('spot_noshow_banner')}
              </h3>
            </div>
            <Link
              to="/join"
              onClick={() => localStorage.removeItem('salon_active_token')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-white font-semibold text-xs shadow-gold transition-colors"
            >
              <span>{t('join_new_queue')}</span>
            </Link>
          </div>
        )}

        {/* Queue Rank & Circular Countdown Progress (Visible when Waiting) */}
        {currentTicket.status === 'Waiting' && (
          <div className="bg-white border border-ivory-200 rounded-2xl p-6 shadow-warm flex flex-col items-center text-center space-y-5">
            {/* Live Position Metric */}
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-charcoal-400 font-semibold block">
                {t('position_header')}
              </span>
              <div className="text-4xl font-display font-bold text-charcoal-900 flex items-center justify-center gap-2">
                <span className="text-gold-500">
                  {queuePosition ? getOrdinal(queuePosition) : '—'}
                </span>
                <span className="text-charcoal-700 text-2xl font-sans font-medium">
                  {t('position_suffix')}
                </span>
              </div>
              {queuePosition === 1 && (
                <p className="text-xs font-bold text-emerald-600 animate-pulse pt-0.5">
                  {t('you_are_next')}
                </p>
              )}
            </div>

            {/* SVG Circular Countdown Ring */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Track Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#F3EBD9"
                  strokeWidth="7"
                  fill="transparent"
                />
                {/* Gold Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#C9A84C"
                  strokeWidth="7"
                  strokeDasharray="264"
                  strokeDashoffset={Math.max(20, Math.min(264, (estimatedWaitMinutes / 90) * 264))}
                  strokeLinecap="round"
                  fill="transparent"
                  className="progress-ring text-gold-500 transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Center Counter */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-5xl font-bold font-sans text-charcoal-900 tracking-tight">
                  ~{estimatedWaitMinutes}
                </span>
                <span className="text-xs font-bold text-gold-500 uppercase tracking-widest mt-1">
                  Minutes
                </span>
                <span className="text-[11px] text-charcoal-400 mt-0.5">
                  {t('estimated_wait')}
                </span>
              </div>
            </div>

            <p className="text-xs text-charcoal-400 max-w-xs">
              {t('wait_estimate_sub')}
            </p>
          </div>
        )}

        {/* Self Cancellation Action Button */}
        {currentTicket.status === 'Waiting' && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-rose-500 hover:text-rose-600 hover:underline font-medium transition-colors cursor-pointer bg-transparent border-0 p-1"
            >
              {t('cancel_spot_btn')}
            </button>
          </div>
        )}

      </div>

      {/* Confirmation Modal for Cancellation */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-ivory-200 rounded-3xl w-full max-w-sm p-6 shadow-warm-xl space-y-4 text-center relative overflow-hidden animate-scaleIn">
            {/* Gold top stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600"></div>

            <button
              onClick={() => setShowCancelModal(false)}
              className="absolute top-4 right-4 text-charcoal-400 hover:text-charcoal-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg text-charcoal-900">
                {t('confirm_cancel_title')}
              </h3>
              <p className="text-xs text-charcoal-600">
                {t('confirm_cancel_body', { token: currentTicket.id })}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm block transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isCancelling ? 'Cancelling...' : t('cancel_confirm_action')}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-full py-2.5 rounded-xl bg-ivory-100 hover:bg-ivory-200 text-charcoal-700 font-medium text-xs transition-colors cursor-pointer border border-ivory-200"
              >
                {t('cancel_abort_action')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
