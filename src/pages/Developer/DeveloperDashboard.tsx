import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { storeCatalog } from '../../services/storeCatalog';
import { getActivityLogs, clearActivityLogs } from '../../services/activityLogger';
import { isSupabaseConfigured } from '../../services/supabase';
import { ActivityLog } from '../../types';
import {
  Shield,
  Database,
  Terminal,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Download,
  Lock,
  ExternalLink,
} from 'lucide-react';

export const DeveloperDashboard: React.FC = () => {
  const { user, isAuthenticated, switchRole } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const supabaseReady = isSupabaseConfigured;
  const productsCount = storeCatalog.getProducts(true).length;
  const verifiedCount = storeCatalog.getProducts(false).length;

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const data = await getActivityLogs();
        setLogs(data);
      } catch (e) {
        console.error('Failed to load dev logs', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isAuthenticated, navigate]);

  const handleClearLogs = async () => {
    if (window.confirm('Clear all audit logs from store records?')) {
      await clearActivityLogs();
      setLogs([]);
    }
  };

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charms-hub-audit-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((l) => (filterType === 'all' ? true : l.event_type === filterType));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#789A99]/20 text-[#789A99] dark:text-[#F1E194]">
              <Terminal className="w-5 h-5" />
            </span>
            <h1 className="font-serif-display text-2xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              Developer &amp; Security Console
            </h1>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#789A99] text-white">
              Root Level
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-stone-400 mt-1">
            Audit trail inspector, database connection telemetry, and RLS role verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportLogs}
            className="px-4 py-2 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC] hover:bg-[#FFD2C2]/40 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleClearLogs}
            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* System Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-stone-400">
            <span>Supabase Gateway</span>
            <Database className="w-4 h-4 text-[#789A99]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              {supabaseReady ? 'Live Cloud' : 'Local Fallback'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                supabaseReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            {supabaseReady ? 'RLS enforced with PostgreSQL' : 'Resilient in-memory & local state'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-stone-400">
            <span>Catalog Items</span>
            <Server className="w-4 h-4 text-[#789A99]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              {productsCount} Total
            </span>
            <span className="text-xs text-emerald-600 font-bold">({verifiedCount} Verified)</span>
          </div>
          <p className="text-[11px] text-gray-400">Integrity verified against real website screenshots</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-stone-400">
            <span>Active Role</span>
            <Lock className="w-4 h-4 text-[#789A99]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              {user?.role.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Client UID: {user?.id.slice(0, 8)}...</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-stone-400">
            <span>Audit Events</span>
            <Activity className="w-4 h-4 text-[#789A99]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              {logs.length} Logged
            </span>
          </div>
          <p className="text-[11px] text-gray-400">All logins, orders, and catalog edits recorded</p>
        </div>
      </div>

      {/* RLS Security Matrix Information */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-4 text-xs">
        <h2 className="font-serif-display text-base font-bold text-[#2B1810] dark:text-[#FCF7DC] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
          <span>Supabase Row-Level Security (RLS) Policy Specifications</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] space-y-1">
            <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Customer Role</p>
            <p className="text-gray-500 text-[11px]">
              - Can read verified products
              <br />- Can insert own orders
              <br />- Can view own orders &amp; invoices (WHERE user_id = auth.uid())
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] space-y-1">
            <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Shop Owner Role</p>
            <p className="text-gray-500 text-[11px]">
              - Full read/write on products catalog
              <br />- View and update status of all customer orders
              <br />- Customize and persist store appearance tokens
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] space-y-1">
            <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Developer Role</p>
            <p className="text-gray-500 text-[11px]">
              - Unrestricted audit trail access
              <br />- Telemetry inspection &amp; RAG synchronization diagnostics
              <br />- Database migration verification
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-serif-display text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
            Security Audit Trail Log ({filteredLogs.length})
          </h2>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Filter Event:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="p-1.5 rounded-lg border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
            >
              <option value="all">All Events</option>
              <option value="user_login">User Login</option>
              <option value="order_created">Order Created</option>
              <option value="order_status_updated">Order Status Updated</option>
              <option value="product_added">Product Added</option>
              <option value="product_updated">Product Updated</option>
              <option value="product_deleted">Product Deleted</option>
              <option value="cart_add">Cart Add</option>
              <option value="cart_remove">Cart Remove</option>
              <option value="appearance_updated">Appearance Updated</option>
              <option value="rag_synced">RAG Synced</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FFF8F5] dark:bg-[#3F070B] border-b border-[#F3DDD5] dark:border-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC]">
                  <th className="p-3 font-bold">Timestamp</th>
                  <th className="p-3 font-bold">Event Type</th>
                  <th className="p-3 font-bold">User Email</th>
                  <th className="p-3 font-bold">Role</th>
                  <th className="p-3 font-bold">Entity</th>
                  <th className="p-3 font-bold">Metadata Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3DDD5] dark:divide-[#7A1921]/60">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-stone-50 dark:hover:bg-[#7A1921]/40">
                    <td className="p-3 font-mono text-gray-400 text-[11px]">
                      {new Date(l.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-[#FFD2C2]/40 text-[#2B1810] dark:bg-[#7A1921] dark:text-[#F1E194]">
                        {l.event_type}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 dark:text-stone-300">{l.user_email || 'Anonymous'}</td>
                    <td className="p-3 font-bold text-[#789A99] dark:text-[#F1E194]">{l.role}</td>
                    <td className="p-3 text-gray-600 dark:text-stone-300">
                      {l.entity_type} ({l.entity_id ? l.entity_id.slice(0, 10) : 'none'})
                    </td>
                    <td className="p-3 text-gray-500 font-mono text-[11px] max-w-xs truncate">
                      {l.metadata ? JSON.stringify(l.metadata) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
