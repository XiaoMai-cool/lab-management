import { useState, useEffect } from 'react';
import { Wrench, MapPin, User, AlertTriangle, Plus, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Equipment, Profile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

interface EquipmentWithUser extends Equipment {
  responsible_user?: Profile;
}

export default function EquipmentList() {
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;

  const [list, setList] = useState<EquipmentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑 modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentWithUser | null>(null);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState<'normal' | 'maintenance' | 'broken'>('normal');
  const [formResponsible, setFormResponsible] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 报障 modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportEquipmentId, setReportEquipmentId] = useState('');
  const [reportNote, setReportNote] = useState('');

  useEffect(() => {
    fetchEquipment();
  }, []);

  async function fetchEquipment() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('equipment')
        .select('*, responsible_user:profiles(*)')
        .order('name', { ascending: true });
      if (fetchErr) throw fetchErr;
      setList(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('name');
    if (data) setProfiles(data);
  }

  function openEdit(item?: EquipmentWithUser) {
    fetchProfiles();
    if (item) {
      setEditingItem(item);
      setFormName(item.name);
      setFormLocation(item.location);
      setFormStatus(item.status);
      setFormResponsible(item.responsible_user_id);
      setFormNotes(item.notes ?? '');
    } else {
      setEditingItem(null);
      setFormName('');
      setFormLocation('');
      setFormStatus('normal');
      setFormResponsible('');
      setFormNotes('');
    }
    setShowEditModal(true);
  }

  async function handleSave() {
    if (!formName || !formLocation || !formResponsible) return;
    try {
      setSubmitting(true);
      const payload = {
        name: formName,
        location: formLocation,
        status: formStatus,
        responsible_user_id: formResponsible,
        notes: formNotes || null,
      };

      if (editingItem) {
        const { error: updateErr } = await supabase
          .from('equipment')
          .update(payload)
          .eq('id', editingItem.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('equipment')
          .insert(payload);
        if (insertErr) throw insertErr;
      }

      setShowEditModal(false);
      fetchEquipment();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  function openReport(equipmentId: string) {
    setReportEquipmentId(equipmentId);
    setReportNote('');
    setShowReportModal(true);
  }

  async function handleReport() {
    if (!reportNote.trim()) return;
    try {
      setSubmitting(true);
      const { error: updateErr } = await supabase
        .from('equipment')
        .update({ status: 'broken', notes: reportNote })
        .eq('id', reportEquipmentId);
      if (updateErr) throw updateErr;
      setShowReportModal(false);
      fetchEquipment();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          加载失败：{error}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="仪器设备管理"
        subtitle={`共 ${list.length} 台设备`}
        action={
          canEdit ? (
            <button
              onClick={() => openEdit()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加设备
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6">
        {list.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="暂无仪器设备"
            description="管理员可添加仪器设备信息"
          />
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {item.name}
                      </h3>
                      <StatusBadge status={item.status} type="equipment" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <User className="w-3.5 h-3.5" />
                        <span>
                          负责人：{item.responsible_user?.name ?? '未指定'}
                        </span>
                      </div>
                    </div>

                    {item.notes && (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    {canEdit && (
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openReport(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="报障"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 编辑/添加设备 Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={editingItem ? '编辑设备' : '添加设备'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowEditModal(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={submitting || !formName || !formLocation || !formResponsible}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              设备名称
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="请输入设备名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              位置
            </label>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="请输入设备位置"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              负责人
            </label>
            <select
              value={formResponsible}
              onChange={(e) => setFormResponsible(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">请选择</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              value={formStatus}
              onChange={(e) =>
                setFormStatus(e.target.value as 'normal' | 'maintenance' | 'broken')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="normal">正常</option>
              <option value="maintenance">维护中</option>
              <option value="broken">故障</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              placeholder="选填"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* 报障 Modal */}
      <Modal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="报告设备故障"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowReportModal(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleReport}
              disabled={submitting || !reportNote.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '提交中...' : '提交报障'}
            </button>
          </div>
        }
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            故障描述
          </label>
          <textarea
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            rows={4}
            placeholder="请描述设备故障情况..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>
      </Modal>
    </div>
  );
}
