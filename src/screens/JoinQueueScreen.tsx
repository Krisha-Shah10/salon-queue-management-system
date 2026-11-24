import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore, joinQueueApi } from '../services/queueStore';
import {
  validateCustomerName,
  validatePhoneNumber,
  validateServicesSelection,
  calculateTotalDuration,
  calculateTotalPrice,
  calculateIndividualWaitTime,
  findActiveTicketByPhone,
  generateNextTokenId,
  checkQueueOperatingHours
} from '../services/queueRules';
import { Service, QueueTicket } from '../types';
import {
  ArrowLeft,
  User,
  Phone,
  Check,
  Zap,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  ShieldAlert
} from 'lucide-react';

export const JoinQueueScreen: React.FC = () => {
  const { t, language } = useTranslation();
  const [salonState] = useQueueStore();
  const navigate = useNavigate();

  const { isQueueOpen, services, barbers, tickets, closingTime } = salonState;

  // Operating status and 30-min pre-closing cutoff check
  const queueHours = useMemo(() => {
    return checkQueueOperatingHours(isQueueOpen, closingTime);
  }, [isQueueOpen, closingTime]);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [preferredBarberId, setPreferredBarberId] = useState<string>('any');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'women' | 'men' | 'unisex'>('all');

  // Touched / Validation States
  const [touched, setTouched] = useState({ name: false, phone: false, services: false });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate Phone Modal State
  const [duplicateTicket, setDuplicateTicket] = useState<QueueTicket | null>(null);

  // Active services list
  const activeServices = useMemo(() => {
    return services.filter(s => s.isActive);
  }, [services]);

  // Displayed services filtered by category
  const displayedServices = useMemo(() => {
    return activeServices.filter(s => selectedCategory === 'all' || (s.category || 'unisex') === selectedCategory);
  }, [activeServices, selectedCategory]);

  // Validations
  const nameValidation = useMemo(() => validateCustomerName(name), [name]);
  const phoneValidation = useMemo(() => validatePhoneNumber(phone), [phone]);
  const servicesValidation = useMemo(() => validateServicesSelection(selectedServices), [selectedServices]);

  // Calculations
  const totalDuration = useMemo(() => calculateTotalDuration(selectedServices), [selectedServices]);
  const totalPrice = useMemo(() => calculateTotalPrice(selectedServices), [selectedServices]);
  const expectedWaitMinutes = useMemo(() => {
    return calculateIndividualWaitTime(tickets, barbers, preferredBarberId);
  }, [tickets, barbers, preferredBarberId]);

  // Handle service card click (Toggle select, Max 3 cap)
  const handleToggleService = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    if (isSelected) {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id));
    } else {
      if (selectedServices.length >= 3) {
        // Max 3 cap reached, prevent adding
        return;
      }
      setSelectedServices(prev => [...prev, service]);
    }
    setTouched(prev => ({ ...prev, services: true }));
  };

  // Form Submit Handler
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTouched({ name: true, phone: true, services: true });

    if (!queueHours.isOpen) {
      alert(queueHours.reason === 'cutoff_closed' ? t('queue_cutoff_msg') : t('err_queue_closed'));
      return;
    }

    if (!nameValidation.isValid || !phoneValidation.isValid || !servicesValidation.isValid) {
      return;
    }

    // Check duplicate phone number in active queue
    const existingTicket = findActiveTicketByPhone(phone, tickets);
    if (existingTicket) {
      setDuplicateTicket(existingTicket);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await joinQueueApi({
        customerName: name.trim(),
        phone: phone.trim().replace(/\D/g, ''),
        services: selectedServices,
        preferredBarberId
      });

      if (!result.success) {
        setIsSubmitting(false);
        if (result.error === 'DUPLICATE_PHONE' && result.existingTicket) {
          setDuplicateTicket(result.existingTicket);
          return;
        }
        alert(result.error || 'Failed to join queue. Please try again.');
        return;
      }

      if (result.ticket) {
        localStorage.setItem('salon_active_token', result.ticket.id);
        navigate(`/status/${result.ticket.id}`);
      }
    } catch (err) {
      console.error('Queue join error:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto w-full px-4 py-6 pb-36 flex flex-col gap-6">

        {/* Back Link & Header */}
        <div className="space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-600 hover:text-gold-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back_home')}</span>
          </Link>

          <div className="bg-white rounded-2xl shadow-warm border border-ivory-200 p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="section-label">{t('join_screen_title')}</span>
              <h1 className="text-2xl font-display font-bold text-charcoal-900 tracking-tight">
                {t('join_screen_title')}
              </h1>
              <p className="text-xs text-charcoal-600 leading-relaxed">
                Fill in your details to secure your live token in line.
              </p>
            </div>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-ivory-200 shadow-inner bg-ivory-100">
              <img
                src="/salon_services.png"
                alt="Salon Services"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Closed Queue Alert */}
        {!queueHours.isOpen && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3 shadow-warm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">{t('closed_badge')}</p>
              <p className="mt-0.5 text-rose-700">
                {queueHours.reason === 'cutoff_closed' ? t('queue_cutoff_msg') : t('queue_closed_msg')}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-6">

          {/* Section 1: Customer Contact Details */}
          <div className="bg-white rounded-2xl shadow-warm border border-ivory-200 p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-ivory-200 pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-gold-100 flex items-center justify-center text-gold-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="section-label">Step 1</span>
                <h2 className="font-display font-semibold text-base text-charcoal-900 leading-tight">
                  {t('customer_info_title')}
                </h2>
              </div>
            </div>

            {/* Customer Name Field */}
            <div className="space-y-1.5">
              <label htmlFor="customer-name" className="block text-xs font-semibold text-charcoal-700">
                {t('customer_name_label')} <span className="text-gold-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="customer-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                  placeholder={t('customer_name_placeholder')}
                  className={`input-warm pl-10 ${
                    (touched.name || formSubmitted) && !nameValidation.isValid ? 'input-error' : ''
                  }`}
                  disabled={!queueHours.isOpen}
                />
                <User className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
              {(touched.name || formSubmitted) && !nameValidation.isValid && (
                <p className="text-rose-600 text-xs flex items-center gap-1.5 mt-1 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{nameValidation.errorKey ? t(nameValidation.errorKey as any) : t('err_name_required')}</span>
                </p>
              )}
            </div>

            {/* Mobile Phone Number Field */}
            <div className="space-y-1.5">
              <label htmlFor="customer-phone" className="block text-xs font-semibold text-charcoal-700">
                {t('customer_phone_label')} <span className="text-gold-500">*</span>
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3.5 rounded-l-xl bg-ivory-100 border border-r-0 border-ivory-200 text-xs font-semibold text-charcoal-700 select-none">
                  +91
                </span>
                <input
                  id="customer-phone"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setPhone(clean);
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                  placeholder={t('customer_phone_placeholder')}
                  className={`input-warm rounded-l-none tracking-wider font-mono ${
                    (touched.phone || formSubmitted) && !phoneValidation.isValid ? 'input-error' : ''
                  }`}
                  disabled={!queueHours.isOpen}
                />
              </div>
              {(touched.phone || formSubmitted) && !phoneValidation.isValid ? (
                <p className="text-rose-600 text-xs flex items-center gap-1.5 mt-1 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{phoneValidation.errorKey ? t(phoneValidation.errorKey as any) : t('err_phone_invalid')}</span>
                </p>
              ) : (
                <p className="text-[11px] text-charcoal-500 flex items-center gap-1.5 mt-1">
                  <Phone className="w-3 h-3 text-gold-500 shrink-0" />
                  <span>{t('phone_privacy_note')}</span>
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Service Selection (Max 3) */}
          <div className="bg-white rounded-2xl shadow-warm border border-ivory-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-ivory-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gold-100 flex items-center justify-center text-gold-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="section-label">Step 2</span>
                  <h2 className="font-display font-semibold text-base text-charcoal-900 leading-tight">
                    {t('select_services_title')}
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5">{t('select_services_sub')}</p>
                </div>
              </div>

              {/* Selection Counter Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border transition-all ${
                  selectedServices.length === 3
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : selectedServices.length > 0
                    ? 'bg-gold-50 border-gold-300 text-gold-700'
                    : 'bg-ivory-100 border-ivory-200 text-charcoal-500'
                }`}
              >
                {selectedServices.length === 3
                  ? t('max_services_pill')
                  : t('selected_count', { count: selectedServices.length })}
              </span>
            </div>

            {(touched.services || formSubmitted) && !servicesValidation.isValid && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{servicesValidation.errorKey ? t(servicesValidation.errorKey as any) : t('err_services_required')}</span>
              </div>
            )}

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
              {(['all', 'women', 'men', 'unisex'] as const).map(cat => {
                const labelKey = `category_${cat}` as const;
                const isCatActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      isCatActive
                        ? 'bg-charcoal-900 text-gold-400 shadow-sm'
                        : 'bg-ivory-100 text-charcoal-600 hover:bg-ivory-200'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>

            {/* Service Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {displayedServices.map((service) => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                const isMaxReached = selectedServices.length >= 3 && !isSelected;
                const category = service.category || 'unisex';
                const catLabelKey = `category_${category}` as const;
                const badgeStyle = category === 'women'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : category === 'men'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gold-50 text-gold-700 border-gold-200';

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleToggleService(service)}
                    disabled={!queueHours.isOpen || isMaxReached}
                    className={`min-h-[68px] text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between relative ${
                      isSelected
                        ? 'bg-gold-50/70 border-gold-500 shadow-warm ring-1 ring-gold-500/30'
                        : isMaxReached
                        ? 'bg-ivory-50/60 border-ivory-200 opacity-45 cursor-not-allowed'
                        : 'bg-white border-ivory-200 hover:border-gold-300 hover:shadow-warm'
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badgeStyle}`}>
                          {t(catLabelKey)}
                        </span>
                        <p className={`font-medium text-sm leading-snug ${isSelected ? 'text-charcoal-900 font-semibold' : 'text-charcoal-800'}`}>
                          {language === 'gu' ? service.nameGu : service.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-charcoal-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gold-500" />
                          {service.durationMinutes}m
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-charcoal-700">₹{service.price}</span>
                      </div>
                    </div>

                    {/* Gold Checkmark Indicator */}
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-gold-500 text-white shadow-sm'
                          : 'border border-ivory-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Barber Preference Picker */}
          <div className="bg-white rounded-2xl shadow-warm border border-ivory-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-ivory-200">
              <div className="w-8 h-8 rounded-lg bg-gold-100 flex items-center justify-center text-gold-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="section-label">Step 3</span>
                <h2 className="font-display font-semibold text-base text-charcoal-900 leading-tight">
                  {t('select_barber_title')}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Any Barber (Fastest) */}
              <button
                type="button"
                onClick={() => setPreferredBarberId('any')}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  preferredBarberId === 'any'
                    ? 'bg-gold-50/70 border-gold-500 shadow-warm ring-1 ring-gold-500/30'
                    : 'bg-white border-ivory-200 hover:border-gold-300 hover:shadow-warm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    preferredBarberId === 'any' ? 'bg-gold-500 text-white shadow-sm' : 'bg-gold-100 text-gold-600'
                  }`}>
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <p className={`font-medium text-sm leading-snug ${preferredBarberId === 'any' ? 'text-charcoal-900 font-semibold' : 'text-charcoal-800'}`}>
                      {t('any_barber')}
                    </p>
                    <p className="text-[11px] text-charcoal-500 mt-0.5">
                      Wait: ~{calculateIndividualWaitTime(tickets, barbers, 'any')} min
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    preferredBarberId === 'any'
                      ? 'bg-gold-500 text-white shadow-sm'
                      : 'border border-ivory-300 bg-white'
                  }`}
                >
                  {preferredBarberId === 'any' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

              {/* Individual Barbers */}
              {barbers.filter(b => b.isOnDuty).map((barber) => {
                const waitEstimate = calculateIndividualWaitTime(tickets, barbers, barber.id);
                const isSelected = preferredBarberId === barber.id;

                return (
                  <button
                    key={barber.id}
                    type="button"
                    onClick={() => setPreferredBarberId(barber.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-gold-50/70 border-gold-500 shadow-warm ring-1 ring-gold-500/30'
                        : 'bg-white border-ivory-200 hover:border-gold-300 hover:shadow-warm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${
                        isSelected ? 'bg-gold-500 text-white shadow-sm' : 'bg-gold-100 text-gold-600'
                      }`}>
                        {barber.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`font-medium text-sm leading-snug ${isSelected ? 'text-charcoal-900 font-semibold' : 'text-charcoal-800'}`}>
                            {barber.name}
                          </p>
                          {barber.status === 'On Break' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-ivory-200 text-charcoal-600 font-medium">
                              Break
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-charcoal-500 mt-0.5">
                          Wait: ~{waitEstimate} min
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-gold-500 text-white shadow-sm'
                          : 'border border-ivory-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sticky Bottom Summary Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-ivory-200 py-3.5 px-4 shadow-warm-lg">
            <div className="max-w-lg mx-auto flex flex-col gap-2.5">
              {/* Metrics Row */}
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-charcoal-600">
                    <strong className="text-charcoal-900 font-semibold">{selectedServices.length}</strong> {t('summary_services')}
                  </span>
                  <span className="text-ivory-300">•</span>
                  <span className="text-charcoal-600">
                    <strong className="text-charcoal-900 font-semibold">{totalDuration}</strong> min
                  </span>
                  <span className="text-ivory-300">•</span>
                  <span className="text-gold-600 font-bold text-sm">
                    ₹{totalPrice}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-gold-600 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-gold-500" />
                  <span>~{expectedWaitMinutes} min wait</span>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                type="submit"
                disabled={!queueHours.isOpen || isSubmitting}
                className="btn-gold w-full min-h-[48px] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>{t('joining_btn')}</span>
                ) : (
                  <>
                    <span>{t('confirm_and_join')}</span>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* Duplicate Phone Number Modal */}
      {duplicateTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-ivory-200 w-full max-w-sm p-6 shadow-warm-xl space-y-4 text-center relative overflow-hidden animate-scaleIn">
            {/* Gold top bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400"></div>

            <button
              type="button"
              onClick={() => setDuplicateTicket(null)}
              className="absolute top-4 right-4 text-charcoal-400 hover:text-charcoal-700 transition-colors p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-100 border border-gold-200 flex items-center justify-center text-gold-600 mt-2">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display font-bold text-xl text-charcoal-900">
                {t('duplicate_phone_title')}
              </h3>
              <p className="text-xs text-charcoal-600 leading-relaxed px-2">
                {t('duplicate_phone_msg', {
                  token: duplicateTicket.id,
                  status: duplicateTicket.status
                })}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                to={`/status/${duplicateTicket.id}`}
                onClick={() => {
                  localStorage.setItem('salon_active_token', duplicateTicket.id);
                  setDuplicateTicket(null);
                }}
                className="btn-gold w-full text-center text-sm font-semibold"
              >
                {t('view_existing_token', { token: duplicateTicket.id })}
              </Link>
              <button
                type="button"
                onClick={() => setDuplicateTicket(null)}
                className="w-full py-3 rounded-xl bg-ivory-100 hover:bg-ivory-200 text-charcoal-700 font-semibold text-xs transition-colors"
              >
                {t('cancel_modal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
