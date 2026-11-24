import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Scissors, Clock, CheckCircle2, AlertTriangle, Coffee, ChevronRight, User } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore } from '../services/queueStore';
import { calculateRemainingChairTime, calculateTotalDuration, calculateTotalPrice } from '../services/queueRules';
import { Barber, QueueTicket } from '../types';

export const BarberScreen: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const { t } = useTranslation();
  const [state, updateState] = useQueueStore();
  const { tickets, barbers } = state;

  const stylistName = name || 'Ravi';
  const barber = barbers.find(b => b.name === stylistName);

  const [isStarting, setIsStarting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isNoShow, setIsNoShow] = useState(false);
  const [showBreakConfirm, setShowBreakConfirm] = useState(false);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [calledElapsed, setCalledElapsed] = useState('');

  // Current in-chair ticket
  const inChairTicket: QueueTicket | undefined = barber?.currentTicketId
    ? tickets.find(t => t.id === barber.currentTicketId && t.status === 'In chair')
    : undefined;

  // Called ticket assigned to this barber
  const calledTicket: QueueTicket | undefined = tickets.find(
    t => t.assignedBarberId === barber?.id && t.status === 'Called'
  );

  // Live elapsed counter for Called customer
  useEffect(() => {
    if (calledTicket?.calledAt) {
      const update = () => {
        const diffSec = Math.floor((Date.now() - new Date(calledTicket.calledAt!).getTime()) / 1000);
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        setCalledElapsed(`${m}:${s < 10 ? '0' : ''}${s}`);
      };
      update();
      const id = setInterval(update, 1000);
      return () => clearInterval(id);
    } else {
      setCalledElapsed('');
    }
  }, [calledTicket?.calledAt]);

  // Total service duration of current ticket
  const totalDuration = inChairTicket ? calculateTotalDuration(inChairTicket.services) : 0;

  // Elapsed service timer
  useEffect(() => {
    if (inChairTicket?.startedAt) {
      const update = () => {
        setElapsed(Math.floor((Date.now() - new Date(inChairTicket.startedAt!).getTime()) / 60000));
      };
      update();
      timerRef.current = setInterval(update, 30000);
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [inChairTicket]);

  // Next waiting customer for this barber
  const nextWaiting: QueueTicket | undefined = useMemo(() => {
    return tickets.find(
      t => t.status === 'Waiting' &&
        (t.preferredBarberId === barber?.id || t.preferredBarberId === 'any')
    );
  }, [tickets, barber]);

  // Narrow to non-null for all handlers below
  const barberDefined: Barber = barber ?? { id: '', name: '', station: 0, specialty: '', status: 'Free', isOnDuty: false };

  if (!barber) {
    return (
      <div className="min-h-screen bg-ivory-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-warm border border-ivory-200 p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="font-display text-2xl text-charcoal-900 mb-2">Stylist Not Found</h2>
          <p className="text-sm text-charcoal-500 mb-6">No stylist named "{stylistName}" is in the roster.</p>
          <div className="flex flex-col gap-2">
            {barbers.map(b => (
              <Link
                key={b.id}
                to={`/barber/${b.name}`}
                className="btn-gold text-sm py-2 text-center"
              >
                {b.name}'s View
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Actions ───────────────────────────────────────────────────────

  async function handleCallNext() {
    if (!nextWaiting) return;
    try {
      const res = await fetch(`/api/barbers/${barberDefined.id}/call-next`, { method: 'POST' });
      if (!res.ok) {
        updateState(prev => ({
          ...prev,
          tickets: prev.tickets.map(t =>
            t.id === nextWaiting.id
              ? { ...t, status: 'Called', assignedBarberId: barberDefined.id, calledAt: new Date().toISOString() }
              : t
          ),
          barbers: prev.barbers.map(b =>
            b.id === barberDefined.id ? { ...b, currentTicketId: nextWaiting.id } : b
          )
        }));
      }
    } catch {
      updateState(prev => ({
        ...prev,
        tickets: prev.tickets.map(t =>
          t.id === nextWaiting.id
            ? { ...t, status: 'Called', assignedBarberId: barberDefined.id, calledAt: new Date().toISOString() }
            : t
        ),
        barbers: prev.barbers.map(b =>
          b.id === barberDefined.id ? { ...b, currentTicketId: nextWaiting.id } : b
        )
      }));
    }
  }

  async function handleStartService() {
    if (!calledTicket) return;
    setIsStarting(true);
    try {
      const res = await fetch(`/api/barbers/${barberDefined.id}/start-service`, { method: 'POST' });
      if (!res.ok) {
        updateState(prev => ({
          ...prev,
          barbers: prev.barbers.map(b =>
            b.id === barberDefined.id
              ? { ...b, status: 'In Service', currentTicketId: calledTicket.id }
              : b
          ),
          tickets: prev.tickets.map(t =>
            t.id === calledTicket.id
              ? { ...t, status: 'In chair', startedAt: new Date().toISOString() }
              : t
          )
        }));
      }
    } catch {
      updateState(prev => ({
        ...prev,
        barbers: prev.barbers.map(b =>
          b.id === barberDefined.id
            ? { ...b, status: 'In Service', currentTicketId: calledTicket.id }
            : b
        ),
        tickets: prev.tickets.map(t =>
          t.id === calledTicket.id
            ? { ...t, status: 'In chair', startedAt: new Date().toISOString() }
            : t
        )
      }));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleDone() {
    if (!inChairTicket) return;
    setIsDone(true);
    try {
      const res = await fetch(`/api/barbers/${barberDefined.id}/done`, { method: 'POST' });
      if (!res.ok) {
        updateState(prev => ({
          ...prev,
          barbers: prev.barbers.map(b =>
            b.id === barberDefined.id
              ? { ...b, status: 'Free', currentTicketId: null }
              : b
          ),
          tickets: prev.tickets.map(t =>
            t.id === inChairTicket.id
              ? { ...t, status: 'Done', completedAt: new Date().toISOString() }
              : t
          )
        }));
      }
    } catch {
      updateState(prev => ({
        ...prev,
        barbers: prev.barbers.map(b =>
          b.id === barberDefined.id
            ? { ...b, status: 'Free', currentTicketId: null }
            : b
        ),
        tickets: prev.tickets.map(t =>
          t.id === inChairTicket.id
            ? { ...t, status: 'Done', completedAt: new Date().toISOString() }
            : t
        )
      }));
    } finally {
      setIsDone(false);
    }
  }

  async function handleNoShow() {
    if (!calledTicket) return;
    setIsNoShow(true);
    try {
      const res = await fetch(`/api/barbers/${barberDefined.id}/no-show`, { method: 'POST' });
      if (!res.ok) {
        updateState(prev => ({
          ...prev,
          barbers: prev.barbers.map(b =>
            b.id === barberDefined.id
              ? { ...b, status: 'Free', currentTicketId: null }
              : b
          ),
          tickets: prev.tickets.map(t =>
            t.id === calledTicket.id
              ? { ...t, status: 'No-show' }
              : t
          )
        }));
      }
    } catch {
      updateState(prev => ({
        ...prev,
        barbers: prev.barbers.map(b =>
          b.id === barberDefined.id
            ? { ...b, status: 'Free', currentTicketId: null }
            : b
        ),
        tickets: prev.tickets.map(t =>
          t.id === calledTicket.id
            ? { ...t, status: 'No-show' }
            : t
        )
      }));
    } finally {
      setIsNoShow(false);
    }
  }

  async function handleToggleBreak() {
    setShowBreakConfirm(false);
    try {
      const res = await fetch(`/api/barbers/${barberDefined.id}/toggle-break`, { method: 'POST' });
      if (!res.ok) {
        updateState(prev => ({
          ...prev,
          barbers: prev.barbers.map(b =>
            b.id === barberDefined.id
              ? { ...b, status: b.status === 'On Break' ? 'Free' : 'On Break' }
              : b
          )
        }));
      }
    } catch {
      updateState(prev => ({
        ...prev,
        barbers: prev.barbers.map(b =>
          b.id === barberDefined.id
            ? { ...b, status: b.status === 'On Break' ? 'Free' : 'On Break' }
            : b
        )
      }));
    }
  }

  const isServing = barberDefined.status === 'In Service';
  const isBreak = barberDefined.status === 'On Break';
  const isFree = barberDefined.status === 'Free';
  const remaining = calculateRemainingChairTime(barberDefined, tickets);
  const progressPct = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;

  return (
    <div className="min-h-screen bg-charcoal-950 text-white flex flex-col" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-charcoal-800 bg-charcoal-900/80 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gold-400 transition-colors">
          ← {t('back_home')}
        </Link>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold text-gold-500 uppercase tracking-widest">{t('barber_view')}</span>
          <span>·</span>
          <span>/barber/{stylistName}</span>
        </div>
        {/* Switch stylist */}
        <div className="flex items-center gap-2">
          {barbers.filter(b => b.name !== stylistName).map(b => (
            <Link
              key={b.id}
              to={`/barber/${b.name}`}
              className="text-xs px-3 py-1.5 rounded-lg bg-charcoal-800 text-gray-400 hover:text-gold-400 border border-charcoal-700 transition-colors"
            >
              {b.name}
            </Link>
          ))}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-7 flex flex-col gap-6">

        {/* Stylist Identity Card */}
        <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl p-6 flex items-center gap-5 relative overflow-hidden">
          {/* Top gold accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600" />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-amber-500 flex items-center justify-center text-charcoal-950 font-black text-2xl flex-shrink-0"
            style={{ fontFamily: 'Playfair Display, serif' }}>
            {stylistName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              {barberDefined.name}
            </h1>
            <p className="text-sm text-gray-400 leading-tight">{barberDefined.specialty}</p>
            <p className="text-xs text-gray-600 mt-0.5">Station {barberDefined.station}</p>
          </div>

          {/* Status badge */}
          <div className="flex flex-col items-end gap-2">
            {isFree && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('available')}
              </span>
            )}
            {isServing && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {t('busy')}
              </span>
            )}
            {isBreak && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal-800 border border-charcoal-600 text-gray-400 text-xs font-bold">
                <Coffee className="w-3 h-3" />
                {t('on_break')}
              </span>
            )}

            {/* Break toggle */}
            {!isServing && !calledTicket && (
              <button
                onClick={() => isBreak ? handleToggleBreak() : setShowBreakConfirm(true)}
                className="text-xs text-gray-500 hover:text-gold-400 underline transition-colors"
              >
                {isBreak ? 'End Break' : 'Take Break'}
              </button>
            )}
          </div>
        </div>

        {/* ── CALLED STATE: Customer on way, start service ─────── */}
        {calledTicket && !inChairTicket && (
          <div className="bg-gradient-to-b from-gold-500/15 to-charcoal-900/60 border-2 border-gold-500 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-400 to-amber-500" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-gold-400 uppercase tracking-widest mb-1">Customer Called</p>
                <div className="text-5xl font-black text-gold-400" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {calledTicket.id}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                <Scissors className="w-6 h-6 text-gold-400" />
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-base font-semibold text-white">{calledTicket.customerName}</span>
              </div>
              <p className="text-sm text-gray-400 pl-6">
                {calledTicket.services.map(s => s.name).join(' + ')}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400 pl-6 pt-0.5">
                <span>{calculateTotalDuration(calledTicket.services)}m · ₹{calculateTotalPrice(calledTicket.services)}</span>
                {calledElapsed && (
                  <span className="font-mono text-gold-400 font-semibold bg-charcoal-800 px-2 py-0.5 rounded border border-charcoal-700">
                    Called {calledElapsed} ago
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartService}
                disabled={isStarting}
                className="flex-1 btn-gold flex items-center justify-center gap-2 py-3 text-sm cursor-pointer"
              >
                <Scissors className="w-4 h-4" />
                {isStarting ? 'Starting…' : t('start_service')}
              </button>
              <button
                onClick={() => setShowNoShowConfirm(true)}
                disabled={isNoShow}
                className="px-4 py-3 rounded-xl bg-charcoal-800 border border-charcoal-600 text-rose-400 text-sm font-semibold hover:bg-rose-500/10 hover:border-rose-500/40 transition-colors cursor-pointer"
              >
                {isNoShow ? '…' : t('mark_noshow')}
              </button>
            </div>
          </div>
        )}

        {/* ── IN SERVICE STATE ─────────────────────────────────── */}
        {isServing && inChairTicket && (
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl p-6 relative overflow-hidden">

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-charcoal-800">
              <div
                className="h-full bg-gradient-to-r from-gold-500 to-amber-400 transition-all duration-30000"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">In Service</p>

            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-5xl font-black text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {inChairTicket.id}
                </div>
                <p className="text-base font-semibold text-gray-200">{inChairTicket.customerName}</p>
                <p className="text-sm text-gray-500">{inChairTicket.services.map(s => s.name).join(' + ')}</p>
              </div>
              {/* Circular time indicator */}
              <div className="text-center">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#283344" strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="26"
                      fill="none"
                      stroke="#C9A84C"
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - progressPct / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gold-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {remaining > 0 ? `~${remaining}m left` : 'Finishing'}
                </p>
              </div>
            </div>

            {/* Elapsed info */}
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-5 border-t border-charcoal-800 pt-3">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {elapsed}m elapsed of {totalDuration}m · ₹{calculateTotalPrice(inChairTicket.services)}
              </span>
            </div>

            <button
              onClick={handleDone}
              disabled={isDone}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
            >
              <CheckCircle2 className="w-5 h-5" />
              {isDone ? 'Completing…' : t('done_service')}
            </button>
          </div>
        )}

        {/* ── FREE STATE ───────────────────────────────────────── */}
        {isFree && !calledTicket && (
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white mb-1">Chair is Free</p>
              <p className="text-sm text-gray-400">
                {nextWaiting
                  ? `Next in line: ${nextWaiting.customerName} (${nextWaiting.id})`
                  : 'No upcoming customers in line'}
              </p>
            </div>
            {nextWaiting ? (
              <button
                onClick={handleCallNext}
                className="btn-gold w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-gold"
              >
                <span>{t('call_next_customer')} ({nextWaiting.id})</span>
              </button>
            ) : (
              <p className="text-xs text-gray-500">Chairs are open for immediate walk-ins.</p>
            )}
          </div>
        )}

        {/* ── BREAK STATE ──────────────────────────────────────── */}
        {isBreak && (
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl p-6 text-center">
            <Coffee className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-white mb-1">On Break</p>
            <p className="text-sm text-gray-500 mb-5">
              You are currently on break. Customers won't be assigned to you.
            </p>
            <button
              onClick={handleToggleBreak}
              className="btn-gold w-full py-3 text-sm"
            >
              End Break & Go Available
            </button>
          </div>
        )}

        {/* ── NEXT CUSTOMER PREVIEW ────────────────────────────── */}
        {nextWaiting && !calledTicket && (
          <div className="bg-charcoal-900/50 border border-charcoal-700/60 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Up Next for You</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-charcoal-800 border border-charcoal-700 flex items-center justify-center text-gold-400 text-sm font-black">
                {nextWaiting.id.replace('S-', '')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{nextWaiting.customerName}</p>
                <p className="text-xs text-gray-500 truncate">{nextWaiting.services.map(s => s.name).join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gold-400 font-bold">{calculateTotalDuration(nextWaiting.services)}m</p>
                <p className="text-xs text-gray-600">₹{calculateTotalPrice(nextWaiting.services)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        )}
      </main>

      {/* ── No-Show Confirm Modal ───────────────────────────────── */}
      {showNoShowConfirm && calledTicket && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 to-rose-700" />
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white text-center mb-1">{t('confirm_noshow_title')}</h3>
            <p className="text-xs text-gray-400 text-center mb-5">
              {t('confirm_noshow_body', { token: calledTicket.id, name: calledTicket.customerName })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNoShowConfirm(false);
                  handleNoShow();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Yes, Mark No-Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Break Confirm Modal ──────────────────────────────────── */}
      {showBreakConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600" />
            <Coffee className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white text-center mb-2">Take a Break?</h3>
            <p className="text-sm text-gray-400 text-center mb-5">
              You won't receive new customers while on break.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBreakConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-gray-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleBreak}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 text-sm font-bold"
              >
                Start Break
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
