import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, Wifi, Clock, Users, CheckCircle2, Coffee, Volume2, Maximize2, Minimize2, Bell, Sparkles } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore } from '../services/queueStore';
import { socket } from '../services/socket';
import { calculateRemainingChairTime, calculateIndividualWaitTime } from '../services/queueRules';
import { QueueTicket } from '../types';

// Ordinal helper
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Live clock component
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-gold-400 text-sm tabular-nums">
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export const DisplayScreen: React.FC = () => {
  const { t } = useTranslation();
  const [state] = useQueueStore();
  const { tickets, barbers } = state;
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [chimeCount, setChimeCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [announcement, setAnnouncement] = useState<{ ticket: QueueTicket; barberName: string; station: number } | null>(null);
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Helper to trigger announcement
  const triggerAnnouncement = (ticket: QueueTicket, bId?: string) => {
    playChime();
    const assignedId = bId || ticket.assignedBarberId;
    const b = barbers.find(barber => barber.id === assignedId);
    setAnnouncement({
      ticket,
      barberName: b ? b.name : 'Stylist',
      station: b ? b.station : 1
    });

    if (announcementTimeoutRef.current) clearTimeout(announcementTimeoutRef.current);
    announcementTimeoutRef.current = setTimeout(() => {
      setAnnouncement(null);
    }, 10000);
  };

  // Listen to Socket.IO ticket_called event
  useEffect(() => {
    const handleTicketCalled = (data: { ticket: QueueTicket; barberId: string }) => {
      if (data?.ticket) {
        triggerAnnouncement(data.ticket, data.barberId);
      }
    };

    socket.on('ticket_called', handleTicketCalled);
    return () => {
      socket.off('ticket_called', handleTicketCalled);
      if (announcementTimeoutRef.current) clearTimeout(announcementTimeoutRef.current);
    };
  }, [barbers]);

  // Track Called tickets for chime fallback
  const calledTickets = tickets.filter(t => t.status === 'Called');
  const prevCalledIdsRef = useRef<Set<string>>(new Set(calledTickets.map(t => t.id)));

  useEffect(() => {
    const currentCalledIds = new Set(calledTickets.map(t => t.id));
    for (const ticket of calledTickets) {
      if (!prevCalledIdsRef.current.has(ticket.id)) {
        triggerAnnouncement(ticket);
        break;
      }
    }
    prevCalledIdsRef.current = currentCalledIds;
  }, [calledTickets]);

  function playChime() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5-E5-G5-C6
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } catch {
      // Audio not available
    }
  }

  // Active stylist stations
  const activeBarbers = barbers.filter(b => b.isOnDuty);
  const waitingTickets = tickets.filter(t => t.status === 'Waiting');

  return (
    <div className="min-h-screen bg-charcoal-950 text-white flex flex-col overflow-hidden" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-charcoal-800 bg-charcoal-900/80 backdrop-blur-sm flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Scissors className="w-6 h-6 text-charcoal-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t('app_name')}
            </h1>
            <p className="text-xs text-gold-500 font-semibold tracking-widest uppercase">{t('tagline')}</p>
          </div>
        </div>

        {/* Centre: status pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-charcoal-800 border border-charcoal-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-gray-300 font-medium">{t('waiting_tv')}</span>
        </div>

        {/* Right: clock + exit */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-charcoal-800 border border-charcoal-700 px-3 py-1.5 rounded-lg">
            <Wifi className="w-4 h-4 text-gold-400" />
            <LiveClock />
          </div>
          <button
            onClick={playChime}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-charcoal-800 border border-charcoal-700 text-xs text-gray-400 hover:text-gold-400 transition-colors cursor-pointer"
            title="Test chime"
          >
            <Volume2 className="w-4 h-4" />
            <span>Chime</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-charcoal-800 border border-charcoal-700 text-xs text-gray-400 hover:text-gold-400 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Window' : 'Fullscreen'}</span>
          </button>
          <Link
            to="/"
            className="text-xs px-3 py-1.5 rounded-lg bg-charcoal-800 text-gray-400 hover:text-white border border-charcoal-700 transition-colors"
          >
            Exit TV View
          </Link>
        </div>
      </header>

      {/* ── Call Announcement Overlay (10-second gold banner) ──────── */}
      {announcement && (
        <div className="bg-gradient-to-r from-gold-500 via-amber-400 to-gold-500 text-charcoal-950 px-8 py-5 flex items-center justify-between shadow-2xl border-b-2 border-charcoal-900 animate-slideDown z-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-charcoal-950 text-gold-400 flex items-center justify-center shadow-lg animate-bounce shrink-0">
              <Bell className="w-8 h-8 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-charcoal-950 text-gold-400 font-black text-xs uppercase tracking-widest">
                  NOW CALLING
                </span>
                <span className="text-4xl font-black font-display tracking-tight text-charcoal-950">
                  {announcement.ticket.id}
                </span>
                <span className="text-2xl font-bold text-charcoal-900">
                  · {announcement.ticket.customerName}
                </span>
              </div>
              <p className="text-sm font-semibold text-charcoal-900 mt-0.5">
                {announcement.ticket.services.map(s => s.name).join(' + ')}
              </p>
            </div>
          </div>

          <div className="text-right pl-6 border-l-2 border-charcoal-950/20">
            <p className="text-xs font-black uppercase tracking-widest text-charcoal-950">Please Proceed To</p>
            <p className="text-3xl font-black text-charcoal-950">
              Station {announcement.station}
            </p>
            <p className="text-sm font-extrabold text-charcoal-900">{announcement.barberName}</p>
          </div>
        </div>
      )}

      {/* ── Main Grid ───────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-12 gap-6 p-6 min-h-0">

        {/* ── LEFT: Now Serving in Chairs (7 cols) ─────────────────── */}
        <div className="col-span-7 flex flex-col gap-5">

          {/* Section Label */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-gold-500" />
            <h2 className="text-xs font-bold tracking-widest text-gold-400 uppercase">Now Serving in Chairs</h2>
          </div>

          {/* Called Tickets — full gold flash */}
          {calledTickets.length > 0 && (
            <div className="space-y-3">
              {calledTickets.map(ticket => {
                const barber = barbers.find(b => b.id === ticket.assignedBarberId);
                return (
                  <div
                    key={ticket.id}
                    className="relative overflow-hidden rounded-2xl border-2 border-gold-500 bg-gradient-to-r from-gold-500/20 to-amber-500/10 p-5 flex items-center justify-between animate-pulse"
                  >
                    <div className="absolute inset-0 bg-gold-400/5" />
                    <div className="relative flex items-center gap-5">
                      <div className="text-5xl font-black text-gold-400" style={{ fontFamily: 'Playfair Display, serif' }}>
                        {ticket.id}
                      </div>
                      <div>
                        <p className="text-white text-lg font-bold">{ticket.customerName}</p>
                        <p className="text-gold-300 text-sm">{ticket.services.map(s => s.name).join(', ')}</p>
                      </div>
                    </div>
                    <div className="relative text-right">
                      {barber && (
                        <>
                          <p className="text-xs text-gold-400 font-semibold uppercase tracking-widest mb-0.5">Proceed to</p>
                          <p className="text-2xl font-black text-white">
                            Station {barber.station}
                          </p>
                          <p className="text-gold-300 text-sm">{barber.name}</p>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-gold-500 text-charcoal-950 text-xs font-black uppercase tracking-wider">
                        🔔 Your Turn!
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stylist Station Cards Grid */}
          <div className="grid grid-cols-3 gap-4 flex-1">
            {activeBarbers.map(barber => {
              const inChairTicket = tickets.find(t => t.id === barber.currentTicketId && t.status === 'In chair');
              const calledTicket = calledTickets.find(t => t.assignedBarberId === barber.id);
              const remaining = calculateRemainingChairTime(barber, tickets);

              const isFree = barber.status === 'Free';
              const isBreak = barber.status === 'On Break';
              const isServing = barber.status === 'In Service';

              return (
                <div
                  key={barber.id}
                  className={`
                    relative rounded-2xl border p-5 flex flex-col gap-3 overflow-hidden transition-all duration-500
                    ${calledTicket
                      ? 'border-gold-500 bg-gradient-to-b from-gold-500/15 to-charcoal-800'
                      : isFree
                        ? 'border-emerald-600 bg-gradient-to-b from-emerald-500/10 to-charcoal-800'
                        : isBreak
                          ? 'border-charcoal-600 bg-charcoal-800/60'
                          : 'border-charcoal-700 bg-charcoal-800/80'
                    }
                  `}
                >
                  {/* Station header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                      Station {barber.station}
                    </span>
                    {isFree && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        OPEN
                      </span>
                    )}
                    {isBreak && (
                      <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                        <Coffee className="w-3 h-3" />
                        BREAK
                      </span>
                    )}
                    {isServing && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        BUSY
                      </span>
                    )}
                  </div>

                  {/* Stylist name */}
                  <div>
                    <p className="text-xl font-black text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {barber.name}
                    </p>
                    <p className="text-xs text-gray-500 leading-tight">{barber.specialty}</p>
                  </div>

                  {/* Token / status info */}
                  {isFree && !calledTicket && (
                    <div className="mt-auto flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold text-sm">Ready for Next</span>
                    </div>
                  )}
                  {isBreak && (
                    <div className="mt-auto text-gray-500 text-sm font-medium">Back soon…</div>
                  )}
                  {inChairTicket && (
                    <div className="mt-auto space-y-1">
                      <div className="text-4xl font-black text-gold-400" style={{ fontFamily: 'Playfair Display, serif' }}>
                        {inChairTicket.id}
                      </div>
                      <p className="text-sm text-gray-300 font-semibold">{inChairTicket.customerName}</p>
                      <p className="text-xs text-gray-500 leading-snug">{inChairTicket.services.map(s => s.name).join(', ')}</p>
                      {remaining > 0 && (
                        <div className="flex items-center gap-1 text-amber-400 text-xs font-bold pt-0.5">
                          <Clock className="w-3 h-3" />
                          ~{remaining}m remaining
                        </div>
                      )}
                    </div>
                  )}
                  {calledTicket && !inChairTicket && (
                    <div className="mt-auto space-y-1">
                      <div className="text-3xl font-black text-gold-400 animate-pulse" style={{ fontFamily: 'Playfair Display, serif' }}>
                        {calledTicket.id}
                      </div>
                      <p className="text-sm text-gold-300 font-semibold">{calledTicket.customerName}</p>
                      <span className="inline-flex text-xs font-bold text-gold-500 bg-gold-500/10 px-2 py-0.5 rounded-full border border-gold-500/30">
                        On the way…
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Up Next in Queue (5 cols) ─────────────────────── */}
        <div className="col-span-5 flex flex-col gap-5">

          {/* Section Label */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-charcoal-600" />
            <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase">Up Next in Queue</h2>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
              <Users className="w-3.5 h-3.5" />
              {waitingTickets.length} waiting
            </span>
          </div>

          {/* Waiting list */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
            {waitingTickets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-white">Queue is Clear!</p>
                <p className="text-sm text-gray-500">Walk-ins welcome · No wait</p>
              </div>
            ) : (
              waitingTickets.slice(0, 8).map((ticket, index) => {
                const waitMins = calculateIndividualWaitTime(tickets, barbers, ticket.preferredBarberId, ticket.id);
                const isNext = index === 0;
                const preferredBarber = ticket.preferredBarberId !== 'any'
                  ? barbers.find(b => b.id === ticket.preferredBarberId)
                  : null;

                return (
                  <div
                    key={ticket.id}
                    className={`
                      flex items-center gap-4 rounded-xl px-4 py-3.5 border transition-all
                      ${isNext
                        ? 'bg-gradient-to-r from-gold-500/15 to-transparent border-gold-600/50'
                        : 'bg-charcoal-800/60 border-charcoal-700'
                      }
                    `}
                  >
                    {/* Position number */}
                    <div className={`
                      w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0
                      ${isNext ? 'bg-gold-500 text-charcoal-950' : 'bg-charcoal-900 text-gray-500 border border-charcoal-700'}
                    `}>
                      {index + 1}
                    </div>

                    {/* Token + name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-black ${isNext ? 'text-gold-400' : 'text-white'}`}
                          style={{ fontFamily: 'Playfair Display, serif' }}>
                          {ticket.id}
                        </span>
                        {isNext && (
                          <span className="text-xs font-bold text-gold-500 bg-gold-500/10 border border-gold-500/30 px-2 py-0.5 rounded-full">
                            Up Next
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {ticket.customerName}
                        {preferredBarber ? ` · ${preferredBarber.name}` : ''}
                      </p>
                      <p className="text-xs text-gray-600 truncate">{ticket.services.map(s => s.name).join(', ')}</p>
                    </div>

                    {/* Wait time */}
                    <div className="text-right flex-shrink-0">
                      <span className={`text-lg font-black ${isNext ? 'text-gold-400' : 'text-gray-400'}`}>
                        ~{waitMins}m
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {waitingTickets.length > 8 && (
              <p className="text-center text-xs text-gray-600 py-2">
                +{waitingTickets.length - 8} more in queue
              </p>
            )}
          </div>

          {/* Footer info card */}
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="text-center">
              <p className="text-2xl font-black text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                {waitingTickets.length}
              </p>
              <p className="text-xs text-gray-500">Waiting</p>
            </div>
            <div className="w-px h-10 bg-charcoal-700" />
            <div className="text-center">
              <p className="text-2xl font-black text-gold-400" style={{ fontFamily: 'Playfair Display, serif' }}>
                {activeBarbers.filter(b => b.status === 'Free').length}
              </p>
              <p className="text-xs text-gray-500">Free Chairs</p>
            </div>
            <div className="w-px h-10 bg-charcoal-700" />
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400" style={{ fontFamily: 'Playfair Display, serif' }}>
                {activeBarbers.filter(b => b.status === 'In Service').length}
              </p>
              <p className="text-xs text-gray-500">In Service</p>
            </div>
            <div className="w-px h-10 bg-charcoal-700" />
            <div className="text-center">
              <p className="text-2xl font-black text-amber-400" style={{ fontFamily: 'Playfair Display, serif' }}>
                {calledTickets.length}
              </p>
              <p className="text-xs text-gray-500">Called</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Marquee footer ──────────────────────────────────────────── */}
      <footer className="border-t border-charcoal-800 bg-charcoal-900/70 py-2.5 overflow-hidden flex-shrink-0">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap px-8">
          <span className="text-xs text-gray-500 font-medium">
            ✦ {t('app_name')} · {t('tagline')} · Your comfort, our craft
          </span>
          <span className="text-xs text-gold-600">✦</span>
          <span className="text-xs text-gray-500 font-medium">
            Queue open {state.isQueueOpen ? 'until ' + state.closingTime : '— closed today'}
          </span>
          <span className="text-xs text-gold-600">✦</span>
          <span className="text-xs text-gray-500 font-medium">
            Scan the QR code at reception to join the queue from your phone
          </span>
          <span className="text-xs text-gold-600">✦</span>
          <span className="text-xs text-gray-500 font-medium">
            {waitingTickets.length} guests currently waiting
          </span>
          <span className="text-xs text-gold-600">✦</span>
        </div>
      </footer>
    </div>
  );
};
