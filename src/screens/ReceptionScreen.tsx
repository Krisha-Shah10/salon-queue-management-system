import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore, joinQueueApi, cancelTicketApi } from '../services/queueStore';
import { calculateTotalDuration, calculateTotalPrice, calculateRemainingChairTime } from '../services/queueRules';
import { QueueTicket, Barber, Service } from '../types';
import {
  LayoutDashboard, Users, UserCheck, Clock, AlertTriangle,
  Plus, PhoneCall, X, UserX, CheckCircle, RefreshCw, Scissors, Sparkles
} from 'lucide-react';

export const ReceptionScreen: React.FC = () => {
  const { t } = useTranslation();
  const [state, updateState] = useQueueStore();
  const { tickets, barbers, services, isQueueOpen } = state;

  // Walk-in modal state
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [preferredBarber, setPreferredBarber] = useState<string>('any');
  const [walkinCategory, setWalkinCategory] = useState<'all' | 'women' | 'men' | 'unisex'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walkinError, setWalkinError] = useState('');
  const [createdTokenNotice, setCreatedTokenNotice] = useState<string | null>(null);

  // Cancellation confirm modal
  const [ticketToCancel, setTicketToCancel] = useState<QueueTicket | null>(null);
  const [ticketForNoShow, setTicketForNoShow] = useState<QueueTicket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active queues
  const waitingTickets = useMemo(() => {
    return tickets
      .filter(t => t.status === 'Waiting')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [tickets]);

  const calledTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'Called');
  }, [tickets]);

  // SLA Alert check (> 60m wait time elapsed)
  const slaBreachedTickets = useMemo(() => {
    const now = Date.now();
    return waitingTickets.filter(t => {
      const waitMin = Math.floor((now - new Date(t.createdAt).getTime()) / 60000);
      return waitMin >= 60;
    });
  }, [waitingTickets]);

  // Service helper calculation
  const walkinDuration = useMemo(() => calculateTotalDuration(selectedServices), [selectedServices]);
  const walkinPrice = useMemo(() => calculateTotalPrice(selectedServices), [selectedServices]);

  // Handlers
  const handleCallNextForBarber = async (barber: Barber) => {
    if (barber.status !== 'Free') return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/barbers/${barber.id}/call-next`, { method: 'POST' });
      if (!res.ok) {
        // Fallback local allocation matching strict backend rules
        const eligible = waitingTickets.find(
          t => t.preferredBarberId === barber.id || t.preferredBarberId === 'any'
        );
        if (eligible) {
          updateState(prev => ({
            ...prev,
            tickets: prev.tickets.map(t =>
              t.id === eligible.id
                ? { ...t, status: 'Called', assignedBarberId: barber.id, calledAt: new Date().toISOString() }
                : t
            ),
            barbers: prev.barbers.map(b =>
              b.id === barber.id ? { ...b, currentTicketId: eligible.id } : b
            )
          }));
        }
      }
    } catch (err) {
      console.warn('API error in call-next, updating local:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartService = async (barber: Barber) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/barbers/${barber.id}/start-service`, { method: 'POST' });
      if (!res.ok) {
        const calledTicket = tickets.find(t => t.assignedBarberId === barber.id && t.status === 'Called');
        if (calledTicket) {
          updateState(prev => ({
            ...prev,
            tickets: prev.tickets.map(t =>
              t.id === calledTicket.id ? { ...t, status: 'In chair', startedAt: new Date().toISOString() } : t
            ),
            barbers: prev.barbers.map(b =>
              b.id === barber.id ? { ...b, status: 'In Service', currentTicketId: calledTicket.id } : b
            )
          }));
        }
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDone = async (barber: Barber) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/barbers/${barber.id}/done`, { method: 'POST' });
      if (!res.ok) {
        updateState(prev => ({
          ...prev,
          tickets: prev.tickets.map(t =>
            t.id === barber.currentTicketId ? { ...t, status: 'Done', completedAt: new Date().toISOString() } : t
          ),
          barbers: prev.barbers.map(b =>
            b.id === barber.id ? { ...b, status: 'Free', currentTicketId: null } : b
          )
        }));
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkNoShow = async (ticket: QueueTicket) => {
    setIsProcessing(true);
    try {
      const barber = barbers.find(b => b.id === ticket.assignedBarberId);
      if (barber) {
        const res = await fetch(`/api/barbers/${barber.id}/no-show`, { method: 'POST' });
        if (!res.ok) {
          updateState(prev => ({
            ...prev,
            tickets: prev.tickets.map(t => t.id === ticket.id ? { ...t, status: 'No-show' } : t),
            barbers: prev.barbers.map(b => b.id === barber.id ? { ...b, status: 'Free', currentTicketId: null } : b)
          }));
        }
      } else {
        // Direct cancel/no-show fallback
        updateState(prev => ({
          ...prev,
          tickets: prev.tickets.map(t => t.id === ticket.id ? { ...t, status: 'No-show' } : t)
        }));
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBreak = async (barber: Barber) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/barbers/${barber.id}/toggle-break`, { method: 'POST' });
      if (!res.ok) {
        const nextStatus = barber.status === 'On Break' ? 'Free' : 'On Break';
        updateState(prev => ({
          ...prev,
          barbers: prev.barbers.map(b => b.id === barber.id ? { ...b, status: nextStatus } : b)
        }));
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!ticketToCancel) return;
    setIsProcessing(true);
    try {
      await cancelTicketApi(ticketToCancel.id);
    } finally {
      setTicketToCancel(null);
      setIsProcessing(false);
    }
  };

  const handleToggleQueueStatus = async () => {
    try {
      await fetch('/api/queue/toggle', { method: 'POST' });
    } catch {
      updateState(prev => ({ ...prev, isQueueOpen: !prev.isQueueOpen }));
    }
  };

  const handleAddWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkinError('');

    if (!walkinName.trim() || walkinName.trim().length < 2) {
      setWalkinError(t('err_name_short'));
      return;
    }
    if (selectedServices.length === 0) {
      setWalkinError(t('err_services_required'));
      return;
    }
    if (selectedServices.length > 3) {
      setWalkinError(t('err_services_max'));
      return;
    }

    const cleanPhone = walkinPhone.trim().replace(/\D/g, '').slice(-10);
    const finalPhone = cleanPhone.length === 10 ? cleanPhone : `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    setIsSubmitting(true);
    try {
      const res = await joinQueueApi({
        customerName: walkinName.trim(),
        phone: finalPhone,
        services: selectedServices,
        preferredBarberId: preferredBarber,
        isWalkin: true
      });

      if (res.success && res.ticket) {
        setCreatedTokenNotice(res.ticket.id);
        setWalkinName('');
        setWalkinPhone('');
        setSelectedServices([]);
        setPreferredBarber('any');
      } else {
        setWalkinError(res.error || 'Failed to add walk-in');
      }
    } catch (err: any) {
      setWalkinError(err?.message || 'Error creating walk-in ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectService = (srv: Service) => {
    if (selectedServices.some(s => s.id === srv.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== srv.id));
    } else {
      if (selectedServices.length >= 3) return;
      setSelectedServices([...selectedServices, srv]);
    }
  };

  return (
    <Layout variant="staff">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">

        {/* ── Dashboard Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-charcoal-800">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-ivory-50">{t('reception_dashboard')}</h1>
              <p className="text-xs text-charcoal-400 mt-0.5 font-medium tracking-wide">
                Tablet Landscape Console · Real-Time Station Dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Queue Toggle Switch */}
            <button
              onClick={handleToggleQueueStatus}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                isQueueOpen
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isQueueOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              Queue: {isQueueOpen ? 'OPEN' : 'CLOSED'}
            </button>

            {/* Live Clock */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-charcoal-800 border border-charcoal-700 text-charcoal-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-gold-400" />
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>

            {/* Quick Add Walkin CTA */}
            <button
              onClick={() => { setCreatedTokenNotice(null); setShowWalkinModal(true); }}
              className="btn-gold flex items-center gap-1.5 py-2 px-4 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              {t('add_walkin')}
            </button>
          </div>
        </div>

        {/* ── SLA Alert Banner (>60 min wait) ── */}
        {slaBreachedTickets.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulseSlow">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  SLA Warning: {slaBreachedTickets.length} customer(s) waiting over 60 minutes!
                </p>
                <p className="text-xs text-charcoal-400 mt-0.5">
                  Tokens: {slaBreachedTickets.map(t => t.id).join(', ')}. Please dispatch earliest available stylist.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-lg">
              &gt; 60m SLA Breach
            </span>
          </div>
        )}

        {/* ── 2-Column Responsive Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Stylist Chair Cards (40%) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-charcoal-800/60 border border-charcoal-700/80 rounded-2xl p-5 shadow-warm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4.5 h-4.5 text-gold-400" />
                  <h2 className="text-sm font-semibold text-ivory-100">Stylist Stations & Chairs</h2>
                </div>
                <span className="text-[11px] font-medium text-charcoal-400 bg-charcoal-900 px-2.5 py-1 rounded-full border border-charcoal-700">
                  {barbers.length} Stations
                </span>
              </div>

              <div className="space-y-3.5">
                {barbers.map(barber => {
                  const inChairTicket = barber.currentTicketId
                    ? tickets.find(t => t.id === barber.currentTicketId && t.status === 'In chair')
                    : undefined;

                  const calledTicket = barber.currentTicketId
                    ? tickets.find(t => t.id === barber.currentTicketId && t.status === 'Called')
                    : tickets.find(t => t.assignedBarberId === barber.id && t.status === 'Called');

                  const remainingTime = calculateRemainingChairTime(barber, tickets);

                  // Earliest eligible customer in line
                  const nextEligible = waitingTickets.find(
                    t => t.preferredBarberId === barber.id || t.preferredBarberId === 'any'
                  );

                  return (
                    <div
                      key={barber.id}
                      className={`relative bg-charcoal-900/80 border rounded-2xl p-4 transition-all overflow-hidden ${
                        calledTicket
                          ? 'border-gold-500/60 bg-gold-500/5 shadow-gold'
                          : inChairTicket
                          ? 'border-amber-500/30'
                          : barber.status === 'Free'
                          ? 'border-emerald-500/30'
                          : 'border-charcoal-700/60'
                      }`}
                    >
                      {/* Top Bar: Station + Stylist info */}
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            barber.status === 'In Service'
                              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                              : barber.status === 'Free'
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : 'bg-charcoal-800 border border-charcoal-700 text-charcoal-400'
                          }`}>
                            {barber.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-ivory-100 truncate">
                              Station {barber.station}: {barber.name}
                            </h3>
                            <p className="text-[11px] text-charcoal-400 truncate">{barber.specialty}</p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            barber.status === 'Free'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : barber.status === 'In Service'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : barber.status === 'On Break'
                              ? 'bg-charcoal-700/50 border-charcoal-600 text-charcoal-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}>
                            {barber.status === 'In Service' ? 'Busy' : barber.status}
                          </span>
                        </div>
                      </div>

                      {/* Active Ticket Status Details */}
                      {calledTicket && (
                        <div className="my-2.5 p-3 rounded-xl bg-gold-500/10 border border-gold-500/30 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gold-400">CALLED — Awaiting Arrival</span>
                            <span className="font-display font-bold text-sm text-gold-400">{calledTicket.id}</span>
                          </div>
                          <p className="text-xs text-ivory-100 font-semibold">{calledTicket.customerName}</p>
                          <div className="flex items-center justify-between text-[11px] text-charcoal-400">
                            <span>{calledTicket.services.map(s => s.name).join(', ')} ({calculateTotalDuration(calledTicket.services)}m)</span>
                            {calledTicket.calledAt && (
                              <span className="font-mono text-gold-400 font-semibold bg-charcoal-800 px-2 py-0.5 rounded border border-charcoal-700">
                                Called {Math.floor((Date.now() - new Date(calledTicket.calledAt).getTime()) / 60000)}m ago
                              </span>
                            )}
                          </div>
                          <div className="pt-2 flex gap-2">
                            <button
                              onClick={() => handleStartService(barber)}
                              disabled={isProcessing}
                              className="btn-gold flex-1 py-1.5 text-xs font-bold text-center cursor-pointer"
                            >
                              {t('start_service')}
                            </button>
                            <button
                              onClick={() => setTicketForNoShow(calledTicket)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {t('mark_noshow')}
                            </button>
                          </div>
                        </div>
                      )}

                      {inChairTicket && (
                        <div className="my-2.5 p-3 rounded-xl bg-charcoal-800/80 border border-charcoal-700 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-400">IN CHAIR</span>
                            <span className="font-display font-bold text-sm text-amber-400">{inChairTicket.id}</span>
                          </div>
                          <p className="text-xs text-ivory-100 font-semibold">{inChairTicket.customerName}</p>
                          <p className="text-[11px] text-charcoal-400">
                            {inChairTicket.services.map(s => s.name).join(', ')}
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-charcoal-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-gold-400" />
                              ~{remainingTime}m remaining
                            </span>
                            <button
                              onClick={() => handleDone(barber)}
                              disabled={isProcessing}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold transition-all"
                            >
                              {t('done_service')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Empty Chair / Break state action buttons */}
                      {!calledTicket && !inChairTicket && (
                        <div className="pt-2 flex items-center justify-between gap-2">
                          {barber.status === 'Free' ? (
                            <button
                              onClick={() => handleCallNextForBarber(barber)}
                              disabled={isProcessing || !nextEligible}
                              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                nextEligible
                                  ? 'bg-gold-500 hover:bg-gold-400 text-charcoal-950 shadow-gold cursor-pointer'
                                  : 'bg-charcoal-800 text-charcoal-500 cursor-not-allowed border border-charcoal-700'
                              }`}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              {nextEligible ? `${t('call_next')} (${nextEligible.id})` : 'No Eligible Customer'}
                            </button>
                          ) : (
                            <div className="text-xs text-charcoal-400 py-1">
                              Stylist is currently {barber.status}
                            </div>
                          )}

                          {/* Break Toggle */}
                          {barber.status !== 'In Service' && (
                            <button
                              onClick={() => handleToggleBreak(barber)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-lg bg-charcoal-800 border border-charcoal-700 text-charcoal-400 hover:text-ivory-100 text-[11px] font-medium transition-colors"
                            >
                              {barber.status === 'On Break' ? 'End Break' : 'Put on Break'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Active Waiting Queue Table (60%) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-charcoal-800/60 border border-charcoal-700/80 rounded-2xl p-5 shadow-warm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4.5 h-4.5 text-gold-400" />
                  <h2 className="text-sm font-semibold text-ivory-100">
                    Active Waiting Queue ({waitingTickets.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-charcoal-400 bg-charcoal-900 px-2.5 py-1 rounded-full border border-charcoal-700">
                    Strict FIFO Order
                  </span>
                </div>
              </div>

              {waitingTickets.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-xl bg-charcoal-900/40 border border-charcoal-700/60">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-ivory-100">{t('empty_queue_title')}</p>
                  <p className="text-xs text-charcoal-400 mt-1">{t('empty_queue_sub')}</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                  {waitingTickets.map((ticket, idx) => {
                    const elapsedMin = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 60000);
                    const isSlaBreached = elapsedMin >= 60;
                    const prefBarberObj = barbers.find(b => b.id === ticket.preferredBarberId);

                    return (
                      <div
                        key={ticket.id}
                        className={`rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-colors ${
                          isSlaBreached
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-charcoal-900/60 border-charcoal-700/80 hover:border-charcoal-600'
                        }`}
                      >
                        {/* Token + Position + Name */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-charcoal-800 border border-charcoal-700 flex items-center justify-center text-xs font-bold text-gold-400 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display font-bold text-sm text-gold-400">{ticket.id}</span>
                              <span className="text-xs font-semibold text-ivory-100 truncate">{ticket.customerName}</span>
                              <span className="text-[11px] text-charcoal-400 font-mono">({ticket.phone})</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-charcoal-400 flex-wrap">
                              <span className="text-ivory-200">{ticket.services.map(s => s.name).join(', ')}</span>
                              <span>·</span>
                              <span>{calculateTotalDuration(ticket.services)}m</span>
                              <span>·</span>
                              <span className="text-gold-400">₹{calculateTotalPrice(ticket.services)}</span>
                              <span>·</span>
                              <span className="px-1.5 py-0.5 rounded bg-charcoal-800 text-[10px] text-charcoal-300">
                                {prefBarberObj ? `Pref: ${prefBarberObj.name}` : 'Any Stylist'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Wait elapsed + Action buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-charcoal-800">
                          <span className={`text-xs font-mono font-semibold px-2 py-1 rounded-md ${
                            isSlaBreached
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : 'bg-charcoal-800 text-charcoal-400'
                          }`}>
                            {elapsedMin}m waited
                          </span>

                          <button
                            onClick={() => setTicketToCancel(ticket)}
                            title="Cancel Ticket"
                            className="p-1.5 rounded-lg bg-charcoal-800 border border-charcoal-700 text-charcoal-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Walkin Card trigger */}
            <button
              onClick={() => { setCreatedTokenNotice(null); setShowWalkinModal(true); }}
              className="w-full py-3.5 px-6 rounded-xl border-2 border-dashed border-gold-500/30 text-gold-400 hover:border-gold-500/60 hover:text-gold-300 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('add_walkin')}
            </button>
          </div>
        </div>

        {/* ── Modal: Add Walk-in Customer ── */}
        {showWalkinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl max-w-lg w-full p-6 space-y-5 relative shadow-warm-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-charcoal-800">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-gold-400" />
                  <h3 className="font-display text-lg font-bold text-ivory-50">{t('add_walkin')}</h3>
                </div>
                <button
                  onClick={() => setShowWalkinModal(false)}
                  className="p-1 text-charcoal-400 hover:text-ivory-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createdTokenNotice ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-widest">Walk-In Token Generated</p>
                    <h4 className="font-display text-4xl font-black text-gold-400 mt-1">{createdTokenNotice}</h4>
                    <p className="text-xs text-charcoal-400 mt-2">Added to queue (FIFO position: #{waitingTickets.length})</p>
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => setCreatedTokenNotice(null)}
                      className="btn-gold flex-1 py-2.5 text-xs font-bold"
                    >
                      + Add Another Walk-in
                    </button>
                    <button
                      onClick={() => setShowWalkinModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold border border-charcoal-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddWalkinSubmit} className="space-y-4">
                  {walkinError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                      {walkinError}
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                      {t('customer_name_label')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={walkinName}
                      onChange={e => setWalkinName(e.target.value)}
                      placeholder={t('customer_name_placeholder')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-ivory-100 text-sm focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  {/* Phone (Optional for walk-in) */}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                      {t('customer_phone_label')} (Optional for walk-in)
                    </label>
                    <input
                      type="tel"
                      value={walkinPhone}
                      onChange={e => setWalkinPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-ivory-100 text-sm focus:outline-none focus:border-gold-500 font-mono"
                    />
                  </div>

                  {/* Services Multi-Select */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-charcoal-300">
                        {t('select_services_title')} (Max 3) *
                      </label>
                      <span className="text-[11px] text-gold-400 font-semibold">
                        {selectedServices.length}/3 selected
                      </span>
                    </div>

                    {/* Category Filter Tabs for Walk-in */}
                    <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5 no-scrollbar">
                      {(['all', 'women', 'men', 'unisex'] as const).map(cat => {
                        const labelKey = `category_${cat}` as const;
                        const isCatActive = walkinCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setWalkinCategory(cat)}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                              isCatActive
                                ? 'bg-gold-500 text-charcoal-900 font-semibold shadow-xs'
                                : 'bg-charcoal-800 text-charcoal-400 hover:text-ivory-100 hover:bg-charcoal-700'
                            }`}
                          >
                            {t(labelKey)}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {services
                        .filter(s => s.isActive && (walkinCategory === 'all' || (s.category || 'unisex') === walkinCategory))
                        .map(s => {
                          const isSelected = selectedServices.some(sel => sel.id === s.id);
                          const cat = s.category || 'unisex';
                          const catBadgeColor = cat === 'women'
                            ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                            : cat === 'men'
                            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                            : 'text-gold-400 bg-gold-500/10 border-gold-500/20';

                          return (
                            <div
                              key={s.id}
                              onClick={() => toggleSelectService(s)}
                              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-gold-500/15 border-gold-500 text-ivory-50'
                                  : 'bg-charcoal-800/80 border-charcoal-700 text-charcoal-300 hover:border-charcoal-600'
                              }`}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className={`text-[9px] font-semibold px-1 py-0.2 rounded border uppercase tracking-wider ${catBadgeColor}`}>
                                  {cat}
                                </span>
                              </div>
                              <p className="text-xs font-semibold truncate">{s.name}</p>
                              <p className="text-[10px] text-charcoal-400 mt-0.5">
                                {s.durationMinutes}m · ₹{s.price}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Stylist Preference */}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                      {t('select_barber_title')}
                    </label>
                    <select
                      value={preferredBarber}
                      onChange={e => setPreferredBarber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-ivory-100 text-sm focus:outline-none focus:border-gold-500"
                    >
                      <option value="any">{t('any_barber')}</option>
                      {barbers.filter(b => b.isOnDuty).map(b => (
                        <option key={b.id} value={b.id}>
                          Station {b.station}: {b.name} ({b.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Live walk-in summary */}
                  {selectedServices.length > 0 && (
                    <div className="p-3 rounded-xl bg-charcoal-800/60 border border-charcoal-700 flex items-center justify-between text-xs">
                      <span className="text-charcoal-300 font-medium">Est. Duration & Price:</span>
                      <span className="font-bold text-gold-400">{walkinDuration} min · ₹{walkinPrice}</span>
                    </div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowWalkinModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || selectedServices.length === 0}
                      className="btn-gold flex-1 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      {isSubmitting ? 'Adding...' : t('confirm_token')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Modal: Confirm No-Show ── */}
        {ticketForNoShow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-warm-xl">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-display text-lg font-bold text-ivory-50">
                  {t('confirm_noshow_title')}
                </h4>
                <p className="text-xs text-charcoal-400 mt-1.5 leading-relaxed">
                  {t('confirm_noshow_body', { token: ticketForNoShow.id, name: ticketForNoShow.customerName })}
                </p>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setTicketForNoShow(null)}
                  className="flex-1 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const target = ticketForNoShow;
                    setTicketForNoShow(null);
                    await handleMarkNoShow(target);
                  }}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  {isProcessing ? 'Updating...' : t('mark_noshow')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Confirm Cancellation ── */}
        {ticketToCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-charcoal-900 border border-charcoal-700 rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-warm-xl">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-display text-lg font-bold text-ivory-50">
                  {t('confirm_cancel_title')}
                </h4>
                <p className="text-xs text-charcoal-400 mt-1.5">
                  Are you sure you want to cancel token <strong>{ticketToCancel.id}</strong> ({ticketToCancel.customerName})?
                </p>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setTicketToCancel(null)}
                  className="flex-1 py-2.5 rounded-xl bg-charcoal-800 border border-charcoal-700 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700"
                >
                  {t('cancel_abort_action')}
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                >
                  {isProcessing ? 'Cancelling...' : t('cancel_confirm_action')}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};
