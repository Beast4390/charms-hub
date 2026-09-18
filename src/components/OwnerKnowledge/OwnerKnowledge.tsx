import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import {
  listKnowledge,
  addKnowledge,
  updateKnowledge,
  deleteKnowledge,
  reindexKnowledge,
  getKnowledgeStatus,
  KnowledgeStatus,
} from '../../services/knowledgeService';
import { getStoreConfig, upsertStoreConfig, STORE_CONFIG_KEYS } from '../../services/storeConfig';
import { useAuth } from '../../context/AuthContext';
import { KnowledgeItem } from '../../types';

const CATEGORIES = [
  'business_information',
  'shipping',
  'returns',
  'cancellation',
  'payments',
  'ordering',
  'customer_support',
  'product_guidance',
  'policies',
  'faq',
];

const emptyForm = { id: '', title: '', content: '', category: 'faq', source: '' };

/** Shop Owner knowledge-base management + store payment configuration. */
export const OwnerKnowledge: React.FC<{ onNotify: (text: string, type?: 'success' | 'error') => void }> = ({ onNotify }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<KnowledgeItem[]>([]);
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [upiSaved, setUpiSaved] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rows, st] = await Promise.all([listKnowledge(), getKnowledgeStatus()]);
    setRows(rows);
    setStatus(st);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    void getStoreConfig(STORE_CONFIG_KEYS.upiMerchantId).then((v) => {
      setUpiId(v ?? '');
      setUpiSaved(Boolean(v));
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = form.id
      ? await updateKnowledge(form.id, form)
      : await addKnowledge(form);
    setSaving(false);
    if (!res.success) {
      onNotify(res.error || 'Failed to save knowledge', 'error');
      return;
    }
    onNotify(form.id ? 'Knowledge updated — marked for re-indexing' : 'Knowledge added — pending embedding');
    setForm(emptyForm);
    setShowForm(false);
    void load();
  };

  const handleToggleActive = async (row: KnowledgeItem) => {
    const res = await updateKnowledge(row.id, { is_active: row.is_active === false });
    if (!res.success) onNotify(res.error || 'Failed to update', 'error');
    else onNotify(row.is_active === false ? 'Knowledge activated' : 'Knowledge deactivated');
    void load();
  };

  const handleDelete = async (row: KnowledgeItem) => {
    if (!window.confirm(`Delete "${row.title}" from the knowledge base?`)) return;
    const res = await deleteKnowledge(row.id);
    if (!res.success) onNotify(res.error || 'Failed to delete', 'error');
    else onNotify('Knowledge deleted');
    void load();
  };

  const handleReindex = async (force: boolean) => {
    setReindexing(true);
    const res = await reindexKnowledge(force);
    setReindexing(false);
    if (!res.success) {
      onNotify(res.error || 'Re-indexing failed', 'error');
      return;
    }
    onNotify(`Re-indexed: ${res.indexed} embedded, ${res.failed} failed`);
    void load();
  };

  const handleSaveUpi = async () => {
    if (!user) return;
    setSavingUpi(true);
    const res = await upsertStoreConfig(STORE_CONFIG_KEYS.upiMerchantId, upiId, user.id);
    setSavingUpi(false);
    if (!res.success) {
      onNotify(res.error || 'Failed to save UPI ID', 'error');
      return;
    }
    setUpiSaved(true);
    onNotify('Merchant UPI ID saved');
  };

  const StatusBadge: React.FC<{ s?: string }> = ({ s }) => {
    if (s === 'indexed')
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" /> Indexed</span>;
    if (s === 'failed')
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><XCircle className="w-3 h-3" /> Failed</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Clock className="w-3 h-3" /> Pending</span>;
  };

  return (
    <div className="space-y-5">
      {/* Store payment configuration */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
          <Wallet className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
          <span>Store Payment Settings</span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={upiId}
            onChange={(e) => { setUpiId(e.target.value); setUpiSaved(false); }}
            placeholder="Merchant UPI ID shown at checkout (e.g. charmshub@upi)"
            className="flex-1 p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-xs text-[#2B1810] dark:text-[#FCF7DC]"
          />
          <button
            onClick={handleSaveUpi}
            disabled={savingUpi}
            className="px-4 py-2.5 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {savingUpi ? 'Saving…' : upiSaved ? 'Saved ✓' : 'Save UPI ID'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400">
          Shown to customers at checkout. No automatic payment confirmation is claimed — UPI orders stay
          Pending Verification until manually confirmed.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Records', value: status?.active ?? '–', icon: BookOpen },
          { label: 'Indexed', value: status?.indexed ?? '–', icon: CheckCircle2 },
          { label: 'Pending', value: status?.pending ?? '–', icon: Clock },
          { label: 'Failed', value: status?.failed ?? '–', icon: AlertCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-4 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921]">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-stone-400">
              <span>{label}</span>
              <Icon className="w-3.5 h-3.5 text-[#789A99] dark:text-[#F1E194]" />
            </div>
            <div className="text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">{value}</div>
          </div>
        ))}
      </div>

      {/* Indexing controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-xs text-gray-500 dark:text-stone-400">
          Last indexed: {status?.lastIndexedAt ? new Date(status.lastIndexedAt).toLocaleString('en-IN') : 'Never'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleReindex(false)}
            disabled={reindexing}
            className="px-4 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            <span>{reindexing ? 'Re-indexing…' : 'Re-index Pending'}</span>
          </button>
          <button
            onClick={() => handleReindex(true)}
            disabled={reindexing}
            className="px-4 py-2 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC] cursor-pointer disabled:opacity-60"
          >
            Force Full Re-index
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      {showForm ? (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
              {form.id ? 'Edit Knowledge' : 'Add Knowledge'}
            </h3>
            <button onClick={() => { setShowForm(false); setForm(emptyForm); }} className="text-gray-400 hover:text-gray-600 cursor-pointer">&times;</button>
          </div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title (e.g. Return Policy)"
            className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-xs text-[#2B1810] dark:text-[#FCF7DC]"
          />
          <textarea
            rows={4}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Verified business information shown to the AI assistant…"
            className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-xs text-[#2B1810] dark:text-[#FCF7DC]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-xs text-[#2B1810] dark:text-[#FCF7DC]"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Source (verified origin of this information)"
              className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-xs text-[#2B1810] dark:text-[#FCF7DC]"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(emptyForm); }} className="px-4 py-2 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] text-xs font-bold text-gray-500 cursor-pointer">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Knowledge'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setForm(emptyForm); setShowForm(true); }}
          className="px-4 py-2 rounded-xl bg-[#FFD2C2]/40 dark:bg-[#7A1921] text-xs font-bold text-[#2B1810] dark:text-[#F1E194] flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Knowledge
        </button>
      )}

      {/* Knowledge list */}
      <div className="rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] divide-y divide-[#F3DDD5] dark:divide-[#7A1921]/60 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Loading knowledge base…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">No knowledge records yet.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">{row.title}</span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#FFF1EC] dark:bg-[#7A1921] text-[#789A99] dark:text-[#F1E194]">{row.category}</span>
                  <StatusBadge s={row.embedding_status} />
                  {row.is_active === false && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-stone-400 line-clamp-2 mt-0.5">{row.content}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggleActive(row)}
                  title={row.is_active === false ? 'Activate' : 'Deactivate'}
                  className="p-2 rounded-lg text-gray-400 hover:text-[#789A99] hover:bg-[#FFF8F5] dark:hover:bg-[#7A1921] cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setForm({ id: row.id, title: row.title, content: row.content, category: row.category, source: row.source }); setShowForm(true); }}
                  title="Edit"
                  className="p-2 rounded-lg text-gray-400 hover:text-[#789A99] hover:bg-[#FFF8F5] dark:hover:bg-[#7A1921] cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(row)}
                  title="Delete"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
