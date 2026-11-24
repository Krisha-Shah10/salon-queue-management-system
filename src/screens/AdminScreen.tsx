import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings, BarChart3, Scissors, Users,
  Clock, AlertTriangle, CheckCircle2, XCircle,
  TrendingUp, Coffee, ArrowLeft, Plus, Edit2, Trash2,
  Sparkles, Check, X, ShieldAlert, SlidersHorizontal,
  Lock, Eye, EyeOff, KeyRound, LogOut, ShieldCheck
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useQueueStore } from '../services/queueStore';
import { calculateTotalPrice, calculateTotalDuration } from '../services/queueRules';
import { Service, Barber, ServiceCategory } from '../types';

const ADMIN_TOKEN_KEY = 'salon_owner_token';

function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAdminToken(token: string) {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

function removeAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

// ── Authentication Gate (Setup & Login) ──────────────────────────────────────
function AuthGate({
  isConfigured,
  onAuthenticated,
}: {
  isConfigured: boolean;
  onAuthenticated: (token: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConfigured) {
      // Setup validation
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/admin/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Failed to setup owner password.');
          setShake(true);
          setTimeout(() => setShake(false), 500);
        } else {
          setAdminToken(data.token);
          onAuthenticated(data.token);
        }
      } catch (err: any) {
        setError(err.message || 'Network error during setup.');
      } finally {
        setLoading(false);
      }
    } else {
      // Login validation
      if (!password) {
        setError('Please enter your owner password.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Incorrect owner password. Access denied.');
          setShake(true);
          setTimeout(() => setShake(false), 500);
        } else {
          setAdminToken(data.token);
          onAuthenticated(data.token);
        }
      } catch (err: any) {
        setError(err.message || 'Network error during login.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-ivory-50 flex items-center justify-center p-6">
      <div
        className={`bg-white rounded-3xl shadow-warm border border-ivory-200 p-8 w-full max-w-md relative overflow-hidden transition-all ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center mb-3 text-gold-600">
            {isConfigured ? <Lock className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
          </div>
          <h2 className="font-display text-2xl font-bold text-charcoal-900">
            {isConfigured ? 'Owner Portal Login' : 'Create Owner Account'}
          </h2>
          <p className="text-xs text-charcoal-500 mt-1 font-medium">
            {isConfigured
              ? 'Enter your confidential owner password to access salon operations.'
              : 'Establish your confidential owner password to protect salon pricing, queue, and revenue controls.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              {isConfigured ? 'Owner Password' : 'Create Password (min 6 characters)'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                className="input-warm w-full text-sm pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isConfigured && (
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="input-warm w-full text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700 p-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span>Verifying...</span>
            ) : isConfigured ? (
              <>
                <Lock className="w-4 h-4" />
                Unlock Dashboard
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Set Password & Enter Dashboard
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-ivory-100">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-charcoal-400 hover:text-gold-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Salon Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const AdminScreen: React.FC = () => {
  const { t } = useTranslation();
  const [state, updateState] = useQueueStore();
  const { services, barbers, tickets, isQueueOpen, closingTime } = state;

  // Authentication State
  const [authChecking, setAuthChecking] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [authToken, setAuthTokenState] = useState<string | null>(getAdminToken());

  // Change Password Modal State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'analytics' | 'services' | 'stylists' | 'queue'>('analytics');

  // Filter category in services view
  const [serviceFilter, setServiceFilter] = useState<'all' | 'men' | 'women' | 'unisex'>('all');

  // Verify auth on mount
  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      try {
        const token = getAdminToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/admin/auth/status', { headers });
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setIsConfigured(Boolean(data.isConfigured));
            if (data.isAuthenticated) {
              setUnlocked(true);
            } else {
              setUnlocked(false);
              removeAdminToken();
              setAuthTokenState(null);
            }
          }
        }
      } catch {
        // Fallback
      } finally {
        if (mounted) setAuthChecking(false);
      }
    }
    checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  // Authorized fetch helper
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const token = authToken || getAdminToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      removeAdminToken();
      setAuthTokenState(null);
      setUnlocked(false);
      throw new Error('UNAUTHORIZED');
    }
    return res;
  };

  const handleLogout = async () => {
    try {
      await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      removeAdminToken();
      setAuthTokenState(null);
      setUnlocked(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (newPassword.length < 6) {
      setChangePasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await adminFetch('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangePasswordError(data.message || 'Failed to change password.');
      } else {
        setChangePasswordSuccess('Password updated successfully!');
        setTimeout(() => {
          setIsChangePasswordOpen(false);
          setCurrPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
          setChangePasswordSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setChangePasswordError(err.message || 'Error updating password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Service Modal state
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [srvName, setSrvName] = useState('');
  const [srvNameGu, setSrvNameGu] = useState('');
  const [srvCategory, setSrvCategory] = useState<ServiceCategory>('unisex');
  const [srvDuration, setSrvDuration] = useState(30);
  const [srvPrice, setSrvPrice] = useState(150);

  // Stylist Modal state
  const [editingStylist, setEditingStylist] = useState<Barber | null>(null);
  const [isStylistModalOpen, setIsStylistModalOpen] = useState(false);
  const [stylistName, setStylistName] = useState('');
  const [stylistSpecialty, setStylistSpecialty] = useState('');
  const [stylistStation, setStylistStation] = useState(1);

  // ── useMemo hooks MUST be declared unconditionally, before any early returns ──
  // Prerequisite computed slices (not hooks — safe to compute early)
  const _doneTickets = useMemo(() => tickets.filter(t => t.status === 'Done'), [tickets]);

  // Average wait time across all serviced tickets
  const avgWaitTime = useMemo(() => {
    const serviced = tickets.filter(t => t.startedAt && t.createdAt);
    if (serviced.length === 0) return 18;
    const totalMinutes = serviced.reduce((sum, t) => {
      const wait = Math.floor((new Date(t.startedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);
      return sum + Math.max(0, wait);
    }, 0);
    return Math.round(totalMinutes / serviced.length);
  }, [tickets]);

  // Busiest Stylist (by completed tickets)
  const busiestBarber = useMemo(() => {
    const counts: Record<string, number> = {};
    _doneTickets.forEach(t => {
      const bId = t.assignedBarberId || t.preferredBarberId;
      if (bId && bId !== 'any') {
        counts[bId] = (counts[bId] || 0) + 1;
      }
    });
    let topId = '';
    let max = -1;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > max) {
        max = count;
        topId = id;
      }
    });
    const found = barbers.find(b => b.id === topId);
    return found ? `${found.name} (${max} served)` : 'None yet';
  }, [_doneTickets, barbers]);

  // Filtered services list for the Services tab
  const displayedServices = useMemo(() => {
    if (serviceFilter === 'all') return services;
    return services.filter(s => (s.category || 'unisex') === serviceFilter);
  }, [services, serviceFilter]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-ivory-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-charcoal-500 font-medium">Securing Owner Portal...</p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <AuthGate
        isConfigured={isConfigured}
        onAuthenticated={(token) => {
          setAuthTokenState(token);
          setUnlocked(true);
          setIsConfigured(true);
        }}
      />
    );
  }

  // Computed Statistics (aliases for use in render body — hooks already declared above)
  const doneTickets = _doneTickets;
  const cancelledTickets = tickets.filter(t => t.status === 'Cancelled');
  const noShowTickets = tickets.filter(t => t.status === 'No-show');
  const waitingTickets = tickets.filter(t => t.status === 'Waiting');
  const inChairTickets = tickets.filter(t => t.status === 'In chair');
  const totalRevenue = doneTickets.reduce((sum, t) => sum + calculateTotalPrice(t.services), 0);

  // ── Handlers: Queue & Admin controls ──────────────────────────────────────
  const toggleQueue = async () => {
    try {
      await adminFetch('/api/admin/toggle-queue', { method: 'POST' });
    } catch {
      updateState(prev => ({ ...prev, isQueueOpen: !prev.isQueueOpen }));
    }
  };

  const resetQueue = async () => {
    if (!window.confirm("⚠️ Are you sure you want to reset today's queue? All active and completed tickets will be permanently cleared.")) {
      return;
    }
    try {
      await adminFetch('/api/admin/reset-queue', { method: 'POST' });
    } catch {
      updateState(prev => ({
        ...prev,
        tickets: [],
        barbers: prev.barbers.map(b => ({ ...b, status: 'Free', currentTicketId: null }))
      }));
    }
  };

  // ── Handlers: Services CRUD ──────────────────────────────────────────────
  const openNewServiceModal = () => {
    setEditingService(null);
    setSrvName('');
    setSrvNameGu('');
    setSrvCategory('unisex');
    setSrvDuration(30);
    setSrvPrice(150);
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (srv: Service) => {
    setEditingService(srv);
    setSrvName(srv.name);
    setSrvNameGu(srv.nameGu);
    setSrvCategory(srv.category || 'unisex');
    setSrvDuration(srv.durationMinutes);
    setSrvPrice(srv.price);
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) return;

    if (editingService) {
      // Edit
      try {
        await adminFetch(`/api/services/${editingService.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: srvName.trim(),
            nameGu: (srvNameGu || srvName).trim(),
            category: srvCategory,
            durationMinutes: srvDuration,
            price: srvPrice
          })
        });
      } catch {
        updateState(prev => ({
          ...prev,
          services: prev.services.map(s => s.id === editingService.id ? {
            ...s,
            name: srvName.trim(),
            nameGu: (srvNameGu || srvName).trim(),
            category: srvCategory,
            durationMinutes: srvDuration,
            price: srvPrice
          } : s)
        }));
      }
    } else {
      // Add
      try {
        await adminFetch('/api/services', {
          method: 'POST',
          body: JSON.stringify({
            name: srvName.trim(),
            nameGu: (srvNameGu || srvName).trim(),
            category: srvCategory,
            durationMinutes: srvDuration,
            price: srvPrice
          })
        });
      } catch {
        const newId = `srv-${Date.now()}`;
        updateState(prev => ({
          ...prev,
          services: [...prev.services, {
            id: newId,
            name: srvName.trim(),
            nameGu: (srvNameGu || srvName).trim(),
            category: srvCategory,
            durationMinutes: srvDuration,
            price: srvPrice,
            isActive: true
          }]
        }));
      }
    }
    setIsServiceModalOpen(false);
  };

  const handleToggleService = async (srv: Service) => {
    try {
      await adminFetch(`/api/services/${srv.id}/toggle`, { method: 'PATCH' });
    } catch {
      updateState(prev => ({
        ...prev,
        services: prev.services.map(s => s.id === srv.id ? { ...s, isActive: !s.isActive } : s)
      }));
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!window.confirm(`Delete service "${name}"?`)) return;
    try {
      await adminFetch(`/api/services/${id}`, { method: 'DELETE' });
    } catch {
      updateState(prev => ({
        ...prev,
        services: prev.services.filter(s => s.id !== id)
      }));
    }
  };

  // ── Handlers: Stylists CRUD ──────────────────────────────────────────────
  const openNewStylistModal = () => {
    setEditingStylist(null);
    setStylistName('');
    setStylistSpecialty('');
    setStylistStation(barbers.length + 1);
    setIsStylistModalOpen(true);
  };

  const openEditStylistModal = (barber: Barber) => {
    setEditingStylist(barber);
    setStylistName(barber.name);
    setStylistSpecialty(barber.specialty);
    setStylistStation(barber.station);
    setIsStylistModalOpen(true);
  };

  const handleSaveStylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stylistName.trim()) return;

    if (editingStylist) {
      // Edit
      try {
        await adminFetch(`/api/barbers/${editingStylist.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: stylistName.trim(),
            specialty: (stylistSpecialty || 'Senior Stylist').trim(),
            station: Number(stylistStation)
          })
        });
      } catch {
        updateState(prev => ({
          ...prev,
          barbers: prev.barbers.map(b => b.id === editingStylist.id ? {
            ...b,
            name: stylistName.trim(),
            specialty: (stylistSpecialty || 'Senior Stylist').trim(),
            station: Number(stylistStation)
          } : b)
        }));
      }
    } else {
      // Add
      try {
        await adminFetch('/api/barbers', {
          method: 'POST',
          body: JSON.stringify({
            name: stylistName.trim(),
            specialty: (stylistSpecialty || 'Senior Stylist').trim(),
            station: Number(stylistStation)
          })
        });
      } catch {
        const newId = `barber-${Date.now()}`;
        updateState(prev => ({
          ...prev,
          barbers: [...prev.barbers, {
            id: newId,
            name: stylistName.trim(),
            station: Number(stylistStation),
            specialty: (stylistSpecialty || 'Senior Stylist').trim(),
            status: 'Free',
            isOnDuty: true,
            currentTicketId: null
          }]
        }));
      }
    }
    setIsStylistModalOpen(false);
  };

  const handleToggleStylistDuty = async (barber: Barber) => {
    try {
      await adminFetch(`/api/barbers/${barber.id}/toggle-duty`, { method: 'PATCH' });
    } catch {
      updateState(prev => ({
        ...prev,
        barbers: prev.barbers.map(b => b.id === barber.id ? {
          ...b,
          isOnDuty: !b.isOnDuty,
          status: b.isOnDuty ? 'Off Duty' : 'Free'
        } : b)
      }));
    }
  };

  const handleDeleteStylist = async (id: string, name: string) => {
    if (!window.confirm(`Remove stylist "${name}" from salon?`)) return;
    try {
      await adminFetch(`/api/barbers/${id}`, { method: 'DELETE' });
    } catch {
      updateState(prev => ({
        ...prev,
        barbers: prev.barbers.filter(b => b.id !== id)
      }));
    }
  };

  // displayedServices is already computed above (before early returns) — no-op here

  return (
    <div className="min-h-screen bg-ivory-50 text-charcoal-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Top Bar ── */}
      <header className="bg-white border-b border-ivory-200 shadow-warm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-charcoal-900">{t('owner_settings')}</h1>
              <p className="text-xs text-charcoal-500 font-medium">Glamour & Scissors · Master Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Authenticated Owner
            </span>
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="text-xs text-charcoal-600 hover:text-gold-700 font-semibold px-2.5 py-1 rounded-lg border border-ivory-200 hover:bg-gold-50 transition-colors flex items-center gap-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
            <Link to="/" className="text-xs text-charcoal-500 hover:text-gold-600 transition-colors flex items-center gap-1 font-semibold pl-2 border-l border-ivory-200">
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit to Salon
            </Link>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-ivory-200">
        <div className="max-w-6xl mx-auto px-5 flex gap-2 overflow-x-auto py-2">
          {[
            { id: 'analytics', label: "Today's Analytics", icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'services', label: `Service Catalog (${services.length})`, icon: <Scissors className="w-4 h-4" /> },
            { id: 'stylists', label: `Stylists (${barbers.length})`, icon: <Users className="w-4 h-4" /> },
            { id: 'queue', label: 'Queue Controls', icon: <SlidersHorizontal className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gold-500 text-charcoal-950 shadow-gold'
                  : 'text-charcoal-600 hover:bg-ivory-100 hover:text-charcoal-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-5 py-7 space-y-7">

        {/* ── TAB 1: Analytics & Stats ─────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal-900">Today's Salon Performance</h2>
              <p className="text-xs text-charcoal-500">Live aggregated metrics updated as tickets complete</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Customers Served', val: doneTickets.length, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Revenue Generated', val: `₹${totalRevenue}`, icon: <TrendingUp className="w-5 h-5 text-gold-600" />, bg: 'bg-gold-50 border-gold-200 text-gold-700' },
                { label: 'Average Wait Time', val: `${avgWaitTime}m`, icon: <Clock className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 border-blue-200 text-blue-700' },
                { label: 'No-Shows / Cancelled', val: `${noShowTickets.length} / ${cancelledTickets.length}`, icon: <XCircle className="w-5 h-5 text-rose-600" />, bg: 'bg-rose-50 border-rose-200 text-rose-700' },
              ].map((card, i) => (
                <div key={i} className="bg-white border border-ivory-200 rounded-2xl p-5 shadow-warm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-charcoal-500">{card.label}</span>
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${card.bg}`}>
                      {card.icon}
                    </div>
                  </div>
                  <p className="font-display text-3xl font-extrabold text-charcoal-900">{card.val}</p>
                </div>
              ))}
            </div>

            {/* Sub-metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-ivory-200 rounded-2xl p-4 shadow-warm">
                <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Busiest Stylist</span>
                <p className="font-display text-base font-bold text-charcoal-900 mt-1">{busiestBarber}</p>
              </div>
              <div className="bg-white border border-ivory-200 rounded-2xl p-4 shadow-warm">
                <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Active In Chairs</span>
                <p className="font-display text-base font-bold text-amber-600 mt-1">{inChairTickets.length} customer(s)</p>
              </div>
              <div className="bg-white border border-ivory-200 rounded-2xl p-4 shadow-warm">
                <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Currently Waiting</span>
                <p className="font-display text-base font-bold text-charcoal-900 mt-1">{waitingTickets.length} in FIFO line</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Services Management ──────────────────────────────── */}
        {activeTab === 'services' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-charcoal-900">Service Catalog Management</h2>
                <p className="text-xs text-charcoal-500">Configure offerings, pricing, durations & categories (Men, Women, Unisex)</p>
              </div>
              <button
                onClick={openNewServiceModal}
                className="btn-gold flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                + Add New Service
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All Services' },
                { id: 'men', label: "Men's" },
                { id: 'women', label: "Women's" },
                { id: 'unisex', label: 'Unisex' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setServiceFilter(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    serviceFilter === cat.id
                      ? 'bg-charcoal-900 text-white'
                      : 'bg-white border border-ivory-200 text-charcoal-600 hover:bg-ivory-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Services Grid */}
            <div className="bg-white border border-ivory-200 rounded-2xl shadow-warm divide-y divide-ivory-200 overflow-hidden">
              {displayedServices.length === 0 ? (
                <div className="py-12 text-center text-charcoal-400 text-xs">No services found in this category.</div>
              ) : (
                displayedServices.map(srv => (
                  <div key={srv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ivory-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Active status indicator */}
                      <button
                        onClick={() => handleToggleService(srv)}
                        title={srv.isActive ? 'Deactivate service' : 'Activate service'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                          srv.isActive
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                            : 'bg-charcoal-100 border-charcoal-200 text-charcoal-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-sm font-bold truncate ${srv.isActive ? 'text-charcoal-900' : 'text-charcoal-400 line-through'}`}>
                            {srv.name}
                          </h4>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            srv.category === 'men'
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : srv.category === 'women'
                              ? 'bg-pink-50 border-pink-200 text-pink-700'
                              : 'bg-purple-50 border-purple-200 text-purple-700'
                          }`}>
                            {srv.category || 'unisex'}
                          </span>
                        </div>
                        <p className="text-xs text-charcoal-400 mt-0.5">{srv.nameGu}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-gold-600">₹{srv.price}</p>
                        <p className="text-[11px] text-charcoal-400 flex items-center gap-1 justify-end font-medium">
                          <Clock className="w-3 h-3" />
                          {srv.durationMinutes} min
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 border-l border-ivory-200 pl-3">
                        <button
                          onClick={() => openEditServiceModal(srv)}
                          className="p-1.5 rounded-lg bg-ivory-100 hover:bg-gold-50 text-charcoal-600 hover:text-gold-700 border border-ivory-200 transition-colors"
                          title="Edit Service"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(srv.id, srv.name)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                          title="Delete Service"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: Stylists Management ──────────────────────────────── */}
        {activeTab === 'stylists' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-charcoal-900">Stylist & Station Roster</h2>
                <p className="text-xs text-charcoal-500">Manage station assignments, specialties, duty toggles and staff profiles</p>
              </div>
              <button
                onClick={openNewStylistModal}
                className="btn-gold flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                + Add Stylist
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {barbers.map(barber => (
                <div
                  key={barber.id}
                  className={`bg-white border rounded-2xl p-5 shadow-warm relative overflow-hidden transition-all ${
                    barber.isOnDuty ? 'border-ivory-200' : 'border-dashed border-charcoal-300 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center font-bold text-gold-700 text-base">
                        {barber.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-charcoal-900">{barber.name}</h4>
                        <span className="text-[11px] font-semibold text-charcoal-400">Station {barber.station}</span>
                      </div>
                    </div>

                    {/* Duty status toggle */}
                    <button
                      onClick={() => handleToggleStylistDuty(barber)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                        barber.isOnDuty
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-charcoal-100 border-charcoal-300 text-charcoal-500'
                      }`}
                    >
                      {barber.isOnDuty ? 'On Duty' : 'Off Duty'}
                    </button>
                  </div>

                  <p className="text-xs text-charcoal-500 mb-4 min-h-[32px] line-clamp-2">{barber.specialty}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-ivory-100">
                    <span className="text-[11px] font-medium text-charcoal-400">
                      Status: <strong className="text-charcoal-700">{barber.status}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditStylistModal(barber)}
                        className="p-1.5 rounded-lg bg-ivory-100 hover:bg-gold-50 text-charcoal-600 hover:text-gold-700 border border-ivory-200 transition-colors"
                        title="Edit Stylist"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStylist(barber.id, barber.name)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                        title="Delete Stylist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: Queue Controls & Reset ────────────────────────────── */}
        {activeTab === 'queue' && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal-900">Salon Operations & Queue Controls</h2>
              <p className="text-xs text-charcoal-500">Configure master online queue switches and daily lifecycle resets</p>
            </div>

            <div className="bg-white border border-ivory-200 rounded-2xl p-5 shadow-warm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-charcoal-900">Online Queue Status</h4>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    Controls whether remote customers can join the queue via mobile (/join).
                  </p>
                </div>
                <button
                  onClick={toggleQueue}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isQueueOpen
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-warm'
                      : 'bg-rose-500 hover:bg-rose-600 text-white'
                  }`}
                >
                  {isQueueOpen ? 'Queue is OPEN (Click to Close)' : 'Queue is CLOSED (Click to Open)'}
                </button>
              </div>

              <div className="pt-3 border-t border-ivory-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-charcoal-700 font-semibold block">Salon Closing Time</span>
                  <span className="text-charcoal-400 text-[11px]">Online queue cutoff applies 30 min before this time</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    defaultValue={closingTime || '21:00'}
                    onBlur={async (e) => {
                      const newTime = e.target.value;
                      if (!newTime) return;
                      try {
                        await adminFetch('/api/admin/set-closing-time', {
                          method: 'POST',
                          body: JSON.stringify({ closingTime: newTime })
                        });
                      } catch {
                        updateState(prev => ({ ...prev, closingTime: newTime }));
                      }
                    }}
                    className="input-warm text-xs font-mono font-bold px-2 py-1"
                  />
                </div>
              </div>
            </div>

            {/* Daily Reset Section */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-800">Reset Queue for New Day</h4>
                  <p className="text-xs text-rose-600 mt-0.5">
                    This permanently clears all tickets (Waiting, Called, In Chair, Done, Cancelled) and frees all chairs. Use at the start of each business day.
                  </p>
                </div>
              </div>
              <button
                onClick={resetQueue}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-warm"
              >
                Reset Today's Queue Data
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── Modal: Add / Edit Service ── */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-ivory-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-warm-xl">
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200">
              <h3 className="font-display text-base font-bold text-charcoal-900">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-charcoal-400 hover:text-charcoal-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Service Name (English) *</label>
                <input
                  type="text"
                  required
                  value={srvName}
                  onChange={e => setSrvName(e.target.value)}
                  placeholder="e.g. Haircut & Styling"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Service Name (Gujarati)</label>
                <input
                  type="text"
                  value={srvNameGu}
                  onChange={e => setSrvNameGu(e.target.value)}
                  placeholder="e.g. હેરકટ અને સ્ટાઇલ"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Category *</label>
                <select
                  value={srvCategory}
                  onChange={e => setSrvCategory(e.target.value as any)}
                  className="input-warm w-full text-xs"
                >
                  <option value="unisex">Unisex (Both Men & Women)</option>
                  <option value="men">Men's Only</option>
                  <option value="women">Women's Only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Duration (Minutes) *</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    required
                    value={srvDuration}
                    onChange={e => setSrvDuration(Number(e.target.value))}
                    className="input-warm w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={srvPrice}
                    onChange={e => setSrvPrice(Number(e.target.value))}
                    className="input-warm w-full text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ivory-200 text-charcoal-600 text-xs font-bold hover:bg-ivory-100"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold flex-1 py-2.5 text-xs font-bold">
                  {editingService ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Stylist ── */}
      {isStylistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-ivory-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-warm-xl">
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200">
              <h3 className="font-display text-base font-bold text-charcoal-900">
                {editingStylist ? 'Edit Stylist' : 'Add New Stylist'}
              </h3>
              <button onClick={() => setIsStylistModalOpen(false)} className="text-charcoal-400 hover:text-charcoal-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStylist} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Stylist Full Name *</label>
                <input
                  type="text"
                  required
                  value={stylistName}
                  onChange={e => setStylistName(e.target.value)}
                  placeholder="e.g. Maya Sharma"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Specialty & Skills</label>
                <input
                  type="text"
                  value={stylistSpecialty}
                  onChange={e => setStylistSpecialty(e.target.value)}
                  placeholder="e.g. Colour Specialist & Hair Spa"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">Station / Chair Number *</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={stylistStation}
                  onChange={e => setStylistStation(Number(e.target.value))}
                  className="input-warm w-full text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsStylistModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ivory-200 text-charcoal-600 text-xs font-bold hover:bg-ivory-100"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold flex-1 py-2.5 text-xs font-bold">
                  {editingStylist ? 'Save Changes' : 'Add Stylist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Change Owner Password ── */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-ivory-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-warm-xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-display text-base font-bold text-charcoal-900">
                  Change Owner Password
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsChangePasswordOpen(false);
                  setChangePasswordError(null);
                  setChangePasswordSuccess(null);
                }}
                className="text-charcoal-400 hover:text-charcoal-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Current Owner Password *
                </label>
                <input
                  type="password"
                  required
                  value={currPassword}
                  onChange={e => setCurrPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-warm w-full text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ivory-200 text-charcoal-600 text-xs font-bold hover:bg-ivory-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="btn-gold flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
