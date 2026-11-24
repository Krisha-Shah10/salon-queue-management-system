import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore } from '../services/queueStore';
import { calculateGlobalWaitTime, calculateRemainingChairTime, checkQueueOperatingHours, isAllStylistsOnBreak } from '../services/queueRules';
import {
  Users,
  Clock,
  ArrowRight,
  Sparkles,
  Scissors,
  CheckCircle2,
  Coffee,
  AlertCircle
} from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const { t, language } = useTranslation();
  const [salonState] = useQueueStore();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'women' | 'men' | 'unisex'>('all');

  const { isQueueOpen, barbers, tickets, services, closingTime } = salonState;

  // Operating status and 30-min pre-closing cutoff check
  const queueHours = useMemo(() => {
    return checkQueueOperatingHours(isQueueOpen, closingTime);
  }, [isQueueOpen, closingTime]);

  const allOnBreak = useMemo(() => {
    return isAllStylistsOnBreak(barbers);
  }, [barbers]);

  // Filtered active services by category
  const filteredServices = useMemo(() => {
    return services.filter(s => s.isActive && (selectedCategory === 'all' || (s.category || 'unisex') === selectedCategory));
  }, [services, selectedCategory]);

  // Active waiting tickets
  const waitingTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'Waiting');
  }, [tickets]);

  const waitingCount = waitingTickets.length;
  const globalWaitMinutes = useMemo(() => {
    return calculateGlobalWaitTime(tickets, barbers);
  }, [tickets, barbers]);

  // Check for existing active token in localStorage
  const savedTokenId = typeof window !== 'undefined' ? localStorage.getItem('salon_active_token') : null;
  const activeUserTicket = useMemo(() => {
    if (!savedTokenId) return null;
    return tickets.find(t => t.id === savedTokenId && (t.status === 'Waiting' || t.status === 'Called' || t.status === 'In chair'));
  }, [savedTokenId, tickets]);

  const userPosition = useMemo(() => {
    if (!activeUserTicket || activeUserTicket.status !== 'Waiting') return null;
    const index = waitingTickets.findIndex(t => t.id === activeUserTicket.id);
    return index >= 0 ? index + 1 : null;
  }, [activeUserTicket, waitingTickets]);

  return (
    <Layout variant="ivory">
      <div className="min-h-full bg-ivory-50 py-6 sm:py-8 lg:py-10 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Tall Image Panel on Desktop */}
            <div className="hidden lg:block lg:col-span-5 sticky top-24">
              <div className="relative rounded-3xl overflow-hidden shadow-warm border border-ivory-200 aspect-[4/5] bg-ivory-100 group">
                <img
                  src="/salon_hero.png"
                  alt={t('app_name')}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-charcoal-950/25 to-transparent flex flex-col justify-end p-8 text-white">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="h-px w-6 bg-gold-400"></span>
                    <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gold-300">
                      {t('tagline')}
                    </span>
                  </div>
                  <h2 className="font-display text-3xl font-bold leading-tight text-white mb-2">
                    {t('app_name')}
                  </h2>
                  <p className="text-xs text-ivory-200/90 font-sans leading-relaxed">
                    Experience tailored grooming with effortless live chair dispatch. Join remotely, relax, and walk in when called.
                  </p>

                  <div className="mt-5 pt-4 border-t border-white/15 flex items-center justify-between">
                    <span className="text-xs text-ivory-300 font-medium">Lounge Status</span>
                    {isQueueOpen ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/85 backdrop-blur-sm text-white text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        {t('open_badge')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/85 backdrop-blur-sm text-white text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-white"></span>
                        {t('closed_badge')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Interactive Column (max-w-2xl on mobile, col-span-7 on desktop) */}
            <div className="lg:col-span-7 max-w-2xl mx-auto w-full flex flex-col gap-6">

              {/* Decorative Hero Image Strip on Mobile */}
              <div className="lg:hidden relative h-40 sm:h-48 w-full rounded-2xl overflow-hidden shadow-warm border border-ivory-200">
                <img
                  src="/salon_hero.png"
                  alt={t('app_name')}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-charcoal-950/20 to-transparent flex items-end p-4 sm:p-5">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-white tracking-wider uppercase px-3 py-1 rounded-full bg-charcoal-900/60 backdrop-blur-md border border-white/20">
                      {t('tagline')}
                    </span>
                    {isQueueOpen ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-[11px] font-semibold backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        {t('open_badge')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 text-white text-[11px] font-semibold backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        {t('closed_badge')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Title & Queue Open/Closed Badge (Desktop and Tablet) */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
                <div>
                  <span className="section-label block">{t('tagline')}</span>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900 tracking-tight">
                    {t('app_name')}
                  </h1>
                </div>

                {/* Status badge for open/closed: green pill with pulsing dot for open, rose pill for closed */}
                <div className="self-start sm:self-auto">
                  {isQueueOpen ? (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{t('open_badge')}</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>{t('closed_badge')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resume Spot Banner (If user already has an active token) */}
              {activeUserTicket && (
                <div className="bg-gradient-to-r from-gold-50 via-white to-gold-50/70 border border-gold-300 rounded-2xl p-4 sm:p-5 shadow-warm flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 text-white flex flex-col items-center justify-center font-bold shadow-gold shrink-0">
                      <span className="text-[10px] font-sans font-medium uppercase tracking-wider opacity-90">{t('your_token')}</span>
                      <span className="text-sm font-mono leading-none">{activeUserTicket.id}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gold-700 font-semibold tracking-wide uppercase truncate">
                        {activeUserTicket.status === 'In chair'
                          ? t('status_in_chair')
                          : activeUserTicket.status === 'Called'
                          ? t('status_called')
                          : userPosition
                          ? `${userPosition}${userPosition === 1 ? 'st' : userPosition === 2 ? 'nd' : userPosition === 3 ? 'rd' : 'th'} ${t('in_line')}`
                          : t('status_waiting')}
                      </p>
                      <p className="text-sm font-bold text-charcoal-900 truncate">
                        {activeUserTicket.customerName}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/status/${activeUserTicket.id}`}
                    className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-gold transition-colors"
                  >
                    <span>{t('view_status_btn')}</span>
                  </Link>
                </div>
              )}

              {/* Live Queue Pulse Card (Hero Card) */}
              <div className="bg-white border border-ivory-200 rounded-2xl p-6 sm:p-8 text-center shadow-warm relative overflow-hidden animate-slideUp">
                {/* Top Gold Gradient Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300"></div>

                {waitingCount === 0 ? (
                  /* Empty State */
                  <div className="py-4 space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900 tracking-tight">
                      {t('empty_queue_title')}
                    </h2>
                    <p className="text-sm text-charcoal-600 max-w-md mx-auto">
                      {t('empty_queue_sub')}
                    </p>
                  </div>
                ) : (
                  /* Normal Live State */
                  <div className="py-4 space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600 mb-2 shadow-sm">
                      <Users className="w-7 h-7" />
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-charcoal-900 tracking-tight">
                      {waitingCount} <span className="font-sans font-normal text-xl sm:text-2xl text-charcoal-600">{t('people_waiting')}</span>
                    </h2>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ivory-100 border border-ivory-200 text-charcoal-800 text-sm font-semibold shadow-inner-warm">
                      {allOnBreak ? (
                        <>
                          <Coffee className="w-4 h-4 text-amber-600" />
                          <span>{t('all_barbers_on_break')}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-gold-600" />
                          <span>{t('about_wait', { minutes: globalWaitMinutes })}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs italic text-charcoal-400 mt-5 pt-4 border-t border-ivory-200">
                  Real-time queue estimates update dynamically as chairs finish.
                </p>
              </div>

              {/* Active Barbers on Duty Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="section-label flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-gold-500" />
                    <span>{t('barbers_on_duty')}</span>
                  </h3>
                  <span className="text-xs text-charcoal-400 font-medium">
                    {barbers.filter(b => b.isOnDuty).length} Stylists
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {barbers.map((barber) => {
                    const remainingTime = calculateRemainingChairTime(barber, tickets);

                    return (
                      <div
                        key={barber.id}
                        className="bg-white border border-ivory-200 rounded-2xl p-3.5 sm:p-4 flex flex-col items-center text-center shadow-warm transition-all duration-200 hover:shadow-warm-md hover:-translate-y-0.5"
                      >
                        {/* Initial avatar circle in gold */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-100 to-gold-200 border border-gold-300 flex items-center justify-center font-display font-bold text-base text-gold-800 mb-2.5 shadow-sm">
                          {barber.name.charAt(0)}
                        </div>

                        <span className="font-semibold text-charcoal-900 text-xs sm:text-sm truncate w-full">
                          {barber.name}
                        </span>

                        {/* Status badges: green=free, amber=busy, gray=break */}
                        <div className="mt-2">
                          {barber.status === 'In Service' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>{t('busy')}</span>
                              {remainingTime > 0 && (
                                <span className="text-[9px] text-amber-600">({remainingTime}m)</span>
                              )}
                            </span>
                          ) : barber.status === 'On Break' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-ivory-100 border border-ivory-200 text-[10px] font-semibold text-charcoal-500">
                              <Coffee className="w-2.5 h-2.5 text-charcoal-400" />
                              <span>{t('on_break')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>{t('free')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Primary Call-to-Action Button */}
              <div>
                {queueHours.isOpen ? (
                  <Link
                    to="/join"
                    className="btn-gold w-full min-h-[52px] py-4 px-6 text-base font-bold tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-gold hover:shadow-warm-lg"
                  >
                    <span>{t('join_queue')}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                ) : (
                  <div className="w-full p-5 rounded-2xl bg-white border border-rose-200 shadow-warm text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-rose-600 text-sm font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      <span>{t('closed_badge')}</span>
                    </div>
                    <p className="text-xs text-charcoal-500">
                      {queueHours.reason === 'cutoff_closed' ? t('queue_cutoff_msg') : t('queue_closed_msg')}
                    </p>
                  </div>
                )}
              </div>

              {/* Popular Services & Pricing Catalog Preview */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="section-label flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-gold-500" />
                    <span>{t('popular_services')}</span>
                  </h3>
                  <span className="text-[11px] text-charcoal-400 font-medium">INR (₹)</span>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'all', label: t('category_all') },
                    { id: 'women', label: t('category_women') },
                    { id: 'men', label: t('category_men') },
                    { id: 'unisex', label: t('category_unisex') },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedCategory(tab.id as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === tab.id
                          ? 'bg-charcoal-900 text-white shadow-sm'
                          : 'bg-white border border-ivory-200 text-charcoal-600 hover:bg-ivory-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {filteredServices.map((srv) => (
                    <div
                      key={srv.id}
                      className="bg-white border border-ivory-200 hover:border-gold-300 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-warm transition-all duration-200 hover:shadow-warm-md group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-charcoal-900 text-sm group-hover:text-gold-700 transition-colors">
                            {language === 'gu' ? srv.nameGu : srv.name}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            srv.category === 'women'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : srv.category === 'men'
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-gold-50 border-gold-200 text-gold-700'
                          }`}>
                            {srv.category === 'women' ? t('category_women') : srv.category === 'men' ? t('category_men') : t('category_unisex')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-charcoal-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gold-500" />
                            {srv.durationMinutes} min
                          </span>
                          <span className="text-ivory-300">•</span>
                          <span className="text-charcoal-400 font-medium">Expert Service</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-display font-bold text-gold-600 text-lg">
                          ₹{srv.price}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};
