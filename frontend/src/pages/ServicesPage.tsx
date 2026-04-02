import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Edit2, Trash2, X, Save, ChevronDown, ChevronUp,
  Tag, Layers, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { Card, Button, Badge, Input, Textarea } from '../components/ui/index';
import { useServices, useCreateService, useUpdateService, useDeleteService } from '../hooks/useServices';
import { useBundles, useUpdateBundle, useDeleteBundle, useAddServiceToBundle, useRemoveServiceFromBundle } from '../hooks/useBundles';
import { bundlesApi } from '../api/bundles';
import { formatCurrency } from '../lib/utils';
import type { Service, Bundle } from '../types';

// Each row in the "new bundle" draft form
interface DraftServiceRow {
  _key: string;
  serviceId: string;
  displayName: string;
  serviceValue: string;
  revenueSharePct: string;
}

function emptyRow(): DraftServiceRow {
  return { _key: Math.random().toString(36).slice(2), serviceId: '', displayName: '', serviceValue: '', revenueSharePct: '' };
}

function isRowComplete(row: DraftServiceRow) {
  return row.serviceId && row.displayName.trim() && row.serviceValue && row.revenueSharePct;
}

// ── Utility ──────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-[rgba(61,90,241,0.08)] flex items-center justify-center text-[#3d5af1]">
        {icon}
      </div>
      <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">{title}</span>
      {count !== undefined && (
        <Badge variant="neutral" size="sm">{count}</Badge>
      )}
    </div>
  );
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onCancel, isPending }: {
  label: string; onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#e2e6f0] rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.14)] flex items-center justify-center">
            <AlertTriangle size={16} className="text-[#E11D48]" />
          </div>
          <div>
            <div className="font-bold font-display text-[#1a1d2e] text-[14px]">Confirm delete</div>
            <div className="text-[12px] text-[#8b90a8]">This cannot be undone</div>
          </div>
        </div>
        <p className="text-[13px] text-[#4a5068] mb-5">
          Are you sure you want to delete <span className="font-semibold text-[#1a1d2e]">{label}</span>?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button
            variant="danger"
            size="md"
            loading={isPending}
            onClick={onConfirm}
            className="flex-1 bg-[#E11D48] border-[#E11D48] text-white hover:bg-[#BE123C] hover:border-[#BE123C]"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────
function ServiceRow({ service }: { service: Service }) {
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description || '');

  const save = () => {
    if (!name.trim()) return;
    updateMutation.mutate(
      { id: service.id, data: { name: name.trim(), description: description.trim() || undefined } },
      { onSuccess: () => setEditing(false) }
    );
  };

  const toggle = () => {
    updateMutation.mutate({ id: service.id, data: { isActive: !service.is_active } });
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete
          label={service.name}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(service.id, { onSuccess: () => setConfirmDelete(false) })}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className="p-4 bg-[#f8fafc] border border-[#e2e6f0] rounded-xl">
        {editing ? (
          <div className="flex flex-col gap-3">
            <Input
              label="Service name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Digital Marketing"
            />
            <Textarea
              label="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this service..."
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setName(service.name); setDescription(service.description || ''); setEditing(false); }}>
                <X size={13} /> Cancel
              </Button>
              <Button size="sm" onClick={save} loading={updateMutation.isPending} disabled={!name.trim()}>
                <Save size={13} /> Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#1a1d2e]">{service.name}</span>
                <Badge variant={service.is_active ? 'success' : 'neutral'} size="sm">
                  {service.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {service.description && (
                <p className="text-[12px] text-[#8b90a8] mt-0.5">{service.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button size="sm" variant="ghost" onClick={toggle} disabled={updateMutation.isPending}>
                {service.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Edit2 size={12} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Bundle card ───────────────────────────────────────────────────────────────
function BundleCard({ bundle, allServices }: { bundle: Bundle; allServices: Service[] }) {
  const updateMutation   = useUpdateBundle();
  const deleteMutation   = useDeleteBundle();
  const addMutation      = useAddServiceToBundle();
  const removeMutation   = useRemoveServiceFromBundle();

  const [expanded, setExpanded]     = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newName, setNewName]       = useState(bundle.name);

  // Add-service form state
  const [showAddForm, setShowAddForm]     = useState(false);
  const [addServiceId, setAddServiceId]   = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addValue, setAddValue]           = useState('');
  const [addRevShare, setAddRevShare]     = useState('');

  const usedServiceIds = new Set((bundle.services || []).map(bs => bs.service_id));
  const availableServices = allServices.filter(s => s.is_active && !usedServiceIds.has(s.id));

  const saveName = () => {
    if (!newName.trim()) return;
    updateMutation.mutate(
      { id: bundle.id, data: { name: newName.trim() } },
      { onSuccess: () => setEditingName(false) }
    );
  };

  const submitAddService = () => {
    if (!addServiceId || !addDisplayName.trim() || !addValue || !addRevShare) return;
    addMutation.mutate(
      {
        bundleId: bundle.id,
        data: {
          serviceId: addServiceId,
          name: addDisplayName.trim(),
          serviceValue: parseFloat(addValue),
          revenueSharePct: parseFloat(addRevShare),
        },
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setAddServiceId('');
          setAddDisplayName('');
          setAddValue('');
          setAddRevShare('');
        },
      }
    );
  };

  const totalValue = (bundle.services || []).reduce((sum, bs) => sum + (bs.service_value || 0), 0);

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete
          label={bundle.name}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(bundle.id, { onSuccess: () => setConfirmDelete(false) })}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <Card className="overflow-hidden">
        {/* Bundle header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Bundle name"
                    className="h-8 text-[13px]"
                  />
                  <Button size="sm" onClick={saveName} loading={updateMutation.isPending}>
                    <Save size={12} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNewName(bundle.name); setEditingName(false); }}>
                    <X size={12} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold font-display text-[#1a1d2e]">{bundle.name}</span>
                  <Badge variant="blue" size="sm">{(bundle.services || []).length} services</Badge>
                </div>
              )}
              <div className="text-[11px] text-[#8b90a8] mt-1">
                Total value: {formatCurrency(totalValue, true)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!editingName && (
                <Button size="sm" variant="secondary" onClick={() => setEditingName(true)}>
                  <Edit2 size={12} />
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={12} />
              </Button>
              <button
                onClick={() => setExpanded(e => !e)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[#8b90a8] hover:text-[#1a1d2e] hover:bg-[#f4f6fb] transition-all"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="border-t border-[#f0f2f8] p-4 flex flex-col gap-3">
            {(bundle.services || []).length === 0 ? (
              <p className="text-[12px] text-[#8b90a8] italic">No services added yet.</p>
            ) : (
              (bundle.services || []).map(bs => (
                <div key={bs.service_id} className="flex items-center justify-between gap-2 p-3 bg-[#f8fafc] border border-[#e2e6f0] rounded-lg">
                  <div>
                    <div className="text-[12px] font-semibold text-[#1a1d2e]">{bs.name}</div>
                    <div className="text-[11px] text-[#8b90a8]">
                      Value: {formatCurrency(bs.service_value, true)} · Rev share: {bs.revenue_share_pct}%
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#E11D48] hover:text-[#BE123C]"
                    loading={removeMutation.isPending}
                    onClick={() => removeMutation.mutate({ bundleId: bundle.id, serviceId: bs.service_id })}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))
            )}

            {/* Add service form */}
            {showAddForm ? (
              <div className="border border-[#e2e6f0] rounded-xl p-3 flex flex-col gap-2.5 bg-white">
                <div className="text-[11px] font-semibold text-[#4a5068] uppercase tracking-wider">Add Service</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-[#64748B] uppercase tracking-[0.16em] mb-1">Service</label>
                    <select
                      className="w-full h-10 bg-white border border-[#E2E8F0] rounded-[8px] px-3 text-[13px] text-[#0F172A] shadow-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all appearance-none cursor-pointer"
                      value={addServiceId}
                      onChange={e => {
                        setAddServiceId(e.target.value);
                        const svc = allServices.find(s => s.id === e.target.value);
                        if (svc) setAddDisplayName(svc.name);
                      }}
                    >
                      <option value="">Select service...</option>
                      {availableServices.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Display name"
                    value={addDisplayName}
                    onChange={e => setAddDisplayName(e.target.value)}
                    placeholder="e.g. SEO Starter"
                  />
                  <Input
                    label="Service value (₱)"
                    type="number"
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    placeholder="0"
                  />
                  <div className="col-span-2">
                    <Input
                      label="Revenue share %"
                      type="number"
                      value={addRevShare}
                      onChange={e => setAddRevShare(e.target.value)}
                      placeholder="0–100"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}><X size={12} /> Cancel</Button>
                  <Button
                    size="sm"
                    onClick={submitAddService}
                    loading={addMutation.isPending}
                    disabled={!addServiceId || !addDisplayName.trim() || !addValue || !addRevShare}
                  >
                    <CheckCircle size={12} /> Add
                  </Button>
                </div>
              </div>
            ) : (
              availableServices.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setShowAddForm(true)}>
                  <Plus size={13} /> Add service to bundle
                </Button>
              )
            )}
          </div>
        )}
      </Card>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Tab = 'services' | 'bundles';

export default function ServicesPage() {
  const qc = useQueryClient();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: bundles  = [], isLoading: bundlesLoading  } = useBundles();
  const createService = useCreateService();

  const [tab, setTab] = useState<Tab>('services');

  // New-service form
  const [showNewService, setShowNewService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');

  // New-bundle form — richer: name + required service rows
  const [showNewBundle, setShowNewBundle]     = useState(false);
  const [newBundleName, setNewBundleName]     = useState('');
  const [draftRows, setDraftRows]             = useState<DraftServiceRow[]>([emptyRow()]);
  const [creatingBundle, setCreatingBundle]   = useState(false);
  const [bundleCreateError, setBundleCreateError] = useState('');

  const activeServices   = services.filter(s => s.is_active);
  const inactiveServices = services.filter(s => !s.is_active);

  // IDs already used in the draft (prevent duplicate service in same bundle)
  const draftUsedIds = new Set(draftRows.map(r => r.serviceId).filter(Boolean));

  const updateDraftRow = (key: string, patch: Partial<DraftServiceRow>) =>
    setDraftRows(rows => rows.map(r => r._key === key ? { ...r, ...patch } : r));

  const removeDraftRow = (key: string) =>
    setDraftRows(rows => rows.length > 1 ? rows.filter(r => r._key !== key) : rows);

  const resetBundleForm = () => {
    setNewBundleName('');
    setDraftRows([emptyRow()]);
    setBundleCreateError('');
    setShowNewBundle(false);
  };

  const completeRows = draftRows.filter(isRowComplete);
  const canSubmitBundle = newBundleName.trim() && completeRows.length > 0;

  const submitNewBundle = async () => {
    if (!canSubmitBundle) return;
    setCreatingBundle(true);
    setBundleCreateError('');
    try {
      const bundle = await bundlesApi.create({ name: newBundleName.trim() });
      for (const row of completeRows) {
        await bundlesApi.addService(bundle.id, {
          serviceId: row.serviceId,
          name: row.displayName.trim(),
          serviceValue: parseFloat(row.serviceValue),
          revenueSharePct: parseFloat(row.revenueSharePct),
        });
      }
      await qc.invalidateQueries({ queryKey: ['bundles'] });
      resetBundleForm();
    } catch (e: any) {
      setBundleCreateError(e?.response?.data?.error || e?.message || 'Failed to create bundle. Please try again.');
    } finally {
      setCreatingBundle(false);
    }
  };

  const submitNewService = () => {
    if (!newServiceName.trim()) return;
    createService.mutate(
      { name: newServiceName.trim(), description: newServiceDesc.trim() || undefined },
      { onSuccess: () => { setNewServiceName(''); setNewServiceDesc(''); setShowNewService(false); } }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-[#e2e6f0] bg-[#f4f6fb] flex-shrink-0">
        <div>
          <h1 className="font-bold text-base font-display text-[#1a1d2e]">Services & Bundles</h1>
          <p className="text-xs text-[#8b90a8]">Manage your service catalog and bundle packages</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'services' && (
            <Button size="sm" onClick={() => setShowNewService(true)}>
              <Plus size={14} /> New Service
            </Button>
          )}
          {tab === 'bundles' && (
            <Button size="sm" onClick={() => setShowNewBundle(true)}>
              <Plus size={14} /> New Bundle
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 pb-0 flex-shrink-0">
        {([
          { key: 'services', icon: <Tag size={13} />, label: 'Services', count: services.length },
          { key: 'bundles',  icon: <Layers size={13} />, label: 'Bundles',  count: bundles.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-[12px] font-medium transition-all border-b-2 ${
              tab === t.key
                ? 'bg-white border-[#3d5af1] text-[#3d5af1]'
                : 'bg-transparent border-transparent text-[#8b90a8] hover:text-[#4a5068]'
            }`}
          >
            {t.icon} {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              tab === t.key ? 'bg-[rgba(61,90,241,0.10)] text-[#3d5af1]' : 'bg-[#f0f2f8] text-[#8b90a8]'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">

          {/* ── Services Tab ─────────────────────────────────── */}
          {tab === 'services' && (
            <>
              {/* New service form */}
              {showNewService && (
                <Card className="p-4 border-[rgba(61,90,241,0.18)] bg-[rgba(61,90,241,0.02)]">
                  <div className="text-xs font-semibold text-[#3d5af1] uppercase tracking-wider mb-3">New Service</div>
                  <div className="flex flex-col gap-3">
                    <Input
                      label="Service name *"
                      value={newServiceName}
                      onChange={e => setNewServiceName(e.target.value)}
                      placeholder="e.g. Digital Marketing"
                      autoFocus
                    />
                    <Textarea
                      label="Description (optional)"
                      value={newServiceDesc}
                      onChange={e => setNewServiceDesc(e.target.value)}
                      rows={2}
                      placeholder="Brief description..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setNewServiceName(''); setNewServiceDesc(''); setShowNewService(false); }}>
                        <X size={13} /> Cancel
                      </Button>
                      <Button size="sm" onClick={submitNewService} loading={createService.isPending} disabled={!newServiceName.trim()}>
                        <Save size={13} /> Create service
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Active services */}
              <Card className="p-5">
                <SectionHeader icon={<Tag size={14} />} title="Active Services" count={activeServices.length} />
                {servicesLoading ? (
                  <p className="text-[13px] text-[#8b90a8]">Loading...</p>
                ) : activeServices.length === 0 ? (
                  <p className="text-[13px] text-[#8b90a8] italic">No active services yet. Create one above.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeServices.map(s => <ServiceRow key={s.id} service={s} />)}
                  </div>
                )}
              </Card>

              {/* Inactive services */}
              {inactiveServices.length > 0 && (
                <Card className="p-5">
                  <SectionHeader icon={<Tag size={14} />} title="Inactive Services" count={inactiveServices.length} />
                  <div className="flex flex-col gap-2">
                    {inactiveServices.map(s => <ServiceRow key={s.id} service={s} />)}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* ── Bundles Tab ──────────────────────────────────── */}
          {tab === 'bundles' && (
            <>
              {/* New bundle form — name + required services */}
              {showNewBundle && (
                <Card className="p-5 border-[rgba(61,90,241,0.18)] bg-[rgba(61,90,241,0.02)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-semibold text-[#3d5af1] uppercase tracking-wider">New Bundle</div>
                      <div className="text-[11px] text-[#8b90a8] mt-0.5">Add a name and at least one service to create this bundle.</div>
                    </div>
                    <button onClick={resetBundleForm} className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#1a1d2e] hover:bg-[#f4f6fb] transition-all">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Bundle name */}
                    <Input
                      label="Bundle name *"
                      value={newBundleName}
                      onChange={e => setNewBundleName(e.target.value)}
                      placeholder="e.g. Growth Starter Pack"
                      autoFocus
                    />

                    {/* Service rows */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-medium text-[#64748B] uppercase tracking-[0.16em]">
                          Services <span className="text-[#E11D48]">*</span>
                          <span className="ml-1 normal-case text-[#8b90a8] tracking-normal">(at least one required)</span>
                        </label>
                      </div>

                      <div className="flex flex-col gap-2">
                        {draftRows.map((row, idx) => {
                          const availableForRow = activeServices.filter(
                            s => s.id === row.serviceId || !draftUsedIds.has(s.id)
                          );
                          return (
                            <div key={row._key} className="p-3 bg-white border border-[#e2e6f0] rounded-xl flex flex-col gap-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-[#4a5068]">Service {idx + 1}</span>
                                {draftRows.length > 1 && (
                                  <button onClick={() => removeDraftRow(row._key)} className="text-[#8b90a8] hover:text-[#E11D48] transition-colors">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Service picker */}
                                <div className="col-span-2">
                                  <label className="block text-[11px] font-medium text-[#64748B] uppercase tracking-[0.16em] mb-1">Service *</label>
                                  <select
                                    className="w-full h-10 bg-white border border-[#E2E8F0] rounded-[8px] px-3 text-[13px] text-[#0F172A] shadow-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)] transition-all appearance-none cursor-pointer"
                                    value={row.serviceId}
                                    onChange={e => {
                                      const svc = activeServices.find(s => s.id === e.target.value);
                                      updateDraftRow(row._key, {
                                        serviceId: e.target.value,
                                        displayName: row.displayName || svc?.name || '',
                                      });
                                    }}
                                  >
                                    <option value="">Select service...</option>
                                    {availableForRow.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                                {/* Display name */}
                                <Input
                                  label="Display name *"
                                  value={row.displayName}
                                  onChange={e => updateDraftRow(row._key, { displayName: e.target.value })}
                                  placeholder="e.g. SEO Starter"
                                />
                                {/* Service value */}
                                <Input
                                  label="Value (₱) *"
                                  type="number"
                                  value={row.serviceValue}
                                  onChange={e => updateDraftRow(row._key, { serviceValue: e.target.value })}
                                  placeholder="0"
                                />
                                {/* Revenue share */}
                                <div className="col-span-2">
                                  <Input
                                    label="Revenue share % *"
                                    type="number"
                                    value={row.revenueSharePct}
                                    onChange={e => updateDraftRow(row._key, { revenueSharePct: e.target.value })}
                                    placeholder="0–100"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add another service row */}
                      {activeServices.length > draftRows.length && (
                        <button
                          onClick={() => setDraftRows(rows => [...rows, emptyRow()])}
                          className="mt-2 flex items-center gap-1.5 text-[12px] text-[#3d5af1] hover:text-[#2d4ad1] font-medium transition-colors"
                        >
                          <Plus size={13} /> Add another service
                        </button>
                      )}
                    </div>

                    {/* Validation hint */}
                    {newBundleName.trim() && completeRows.length === 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(244,63,94,0.04)] border border-[rgba(244,63,94,0.14)] rounded-lg">
                        <AlertTriangle size={12} className="text-[#E11D48] flex-shrink-0" />
                        <span className="text-[11px] text-[#be123c]">Complete at least one service row to create this bundle.</span>
                      </div>
                    )}

                    {bundleCreateError && (
                      <div className="px-3 py-2 bg-[#fff1f2] border border-[#fecdd3] rounded-lg text-[12px] text-[#e11d48]">
                        {bundleCreateError}
                      </div>
                    )}

                    <div className="flex gap-2 justify-end pt-1 border-t border-[#e9ecf4]">
                      <Button size="sm" variant="ghost" onClick={resetBundleForm} disabled={creatingBundle}>
                        <X size={13} /> Cancel
                      </Button>
                      <Button size="sm" onClick={submitNewBundle} loading={creatingBundle} disabled={!canSubmitBundle || creatingBundle}>
                        <Save size={13} /> Create bundle
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bundle list */}
              {bundlesLoading ? (
                <p className="text-[13px] text-[#8b90a8] p-2">Loading...</p>
              ) : bundles.length === 0 ? (
                <Card className="p-10 flex flex-col items-center gap-3 text-center">
                  <Layers size={28} className="text-[#c8cfe8]" />
                  <p className="text-[13px] font-medium text-[#8b90a8]">No bundles yet</p>
                  <p className="text-[12px] text-[#8b90a8]">Create a bundle and configure the services and revenue share inside it.</p>
                  <Button size="sm" onClick={() => { setShowNewBundle(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus size={13} /> Create first bundle</Button>
                </Card>
              ) : (
                bundles.map(b => (
                  <BundleCard key={b.id} bundle={b} allServices={services} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
