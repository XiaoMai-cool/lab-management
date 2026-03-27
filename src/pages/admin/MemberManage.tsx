import { useEffect, useState } from 'react';
import { Plus, Pencil, ArrowRightLeft, Users, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile, Role } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

const roleLabels: Record<Role, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '板块负责人',
  teacher: '教师',
  student: '学生',
};

const roleColors: Record<Role, string> = {
  super_admin: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  teacher: 'bg-green-100 text-green-700',
  student: 'bg-gray-100 text-gray-700',
};

const allModules = [
  { key: 'supplies', label: '耗材管理' },
  { key: 'chemicals', label: '危化品管理' },
  { key: 'documents', label: '制度文档' },
  { key: 'duty', label: '排班管理' },
  { key: 'meetings', label: '组会管理' },
  { key: 'reimbursements', label: '报销管理' },
];

interface InviteForm {
  name: string;
  email: string;
  role: Role;
}

const defaultInviteForm: InviteForm = {
  name: '',
  email: '',
  role: 'student',
};

interface EditForm {
  role: Role;
  managed_modules: string[];
}

interface TransferForm {
  module: string;
  currentUserId: string;
  newUserId: string;
}

export default function MemberManage() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(defaultInviteForm);
  const [inviting, setInviting] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    role: 'student',
    managed_modules: [],
  });
  const [saving, setSaving] = useState(false);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>({
    module: '',
    currentUserId: '',
    newUserId: '',
  });
  const [transferring, setTransferring] = useState(false);

  async function fetchMembers() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (fetchError) {
      setError('加载成员列表失败');
      console.error(fetchError);
    } else {
      setMembers(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  // Invite handlers
  function openInvite() {
    setInviteForm(defaultInviteForm);
    setInviteOpen(true);
  }

  async function handleInvite() {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
    setInviting(true);

    try {
      // Insert profile record; auth account must be created separately via Supabase Dashboard
      const { error: insertError } = await supabase.from('profiles').insert({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        managed_modules: [],
      });

      if (insertError) throw insertError;

      setInviteOpen(false);
      fetchMembers();
    } catch (err) {
      console.error('Invite failed:', err);
      setError('添加成员失败，请重试');
    } finally {
      setInviting(false);
    }
  }

  // Edit handlers
  function openEdit(member: Profile) {
    setEditingMember(member);
    setEditForm({
      role: member.role,
      managed_modules: member.managed_modules ?? [],
    });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingMember) return;
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: editForm.role,
          managed_modules: editForm.managed_modules,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMember.id);

      if (updateError) throw updateError;

      setEditOpen(false);
      setEditingMember(null);
      fetchMembers();
    } catch (err) {
      console.error('Save failed:', err);
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(key: string) {
    setEditForm((prev) => ({
      ...prev,
      managed_modules: prev.managed_modules.includes(key)
        ? prev.managed_modules.filter((m) => m !== key)
        : [...prev.managed_modules, key],
    }));
  }

  // Transfer handlers
  function openTransfer() {
    setTransferForm({ module: '', currentUserId: '', newUserId: '' });
    setTransferOpen(true);
  }

  function handleModuleChange(module: string) {
    const currentManager = members.find(
      (m) => m.managed_modules?.includes(module)
    );
    setTransferForm({
      module,
      currentUserId: currentManager?.id ?? '',
      newUserId: '',
    });
  }

  async function handleTransfer() {
    if (!transferForm.module || !transferForm.newUserId) return;
    setTransferring(true);

    try {
      // Remove module from current owner
      if (transferForm.currentUserId) {
        const current = members.find(
          (m) => m.id === transferForm.currentUserId
        );
        if (current) {
          await supabase
            .from('profiles')
            .update({
              managed_modules: (current.managed_modules ?? []).filter(
                (m) => m !== transferForm.module
              ),
              updated_at: new Date().toISOString(),
            })
            .eq('id', current.id);
        }
      }

      // Add module to new owner
      const newOwner = members.find(
        (m) => m.id === transferForm.newUserId
      );
      if (newOwner) {
        const updatedModules = [
          ...(newOwner.managed_modules ?? []).filter(
            (m) => m !== transferForm.module
          ),
          transferForm.module,
        ];

        await supabase
          .from('profiles')
          .update({
            managed_modules: updatedModules,
            updated_at: new Date().toISOString(),
          })
          .eq('id', newOwner.id);
      }

      setTransferOpen(false);
      fetchMembers();
    } catch (err) {
      console.error('Transfer failed:', err);
      setError('权限交接失败，请重试');
    } finally {
      setTransferring(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const currentTransferOwner = transferForm.currentUserId
    ? members.find((m) => m.id === transferForm.currentUserId)
    : null;

  return (
    <div>
      <PageHeader
        title="人员管理"
        subtitle="管理课题组成员账号和权限"
        action={
          <div className="flex gap-2">
            <button
              onClick={openTransfer}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">权限交接</span>
            </button>
            <button
              onClick={openInvite}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              邀请成员
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-6 pb-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="暂无成员"
            description="点击右上角按钮邀请成员"
          />
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {member.name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}
                      >
                        {roleLabels[member.role]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{member.email}</p>
                    {member.managed_modules && member.managed_modules.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {member.managed_modules.map((mod) => {
                          const moduleInfo = allModules.find(
                            (m) => m.key === mod
                          );
                          return (
                            <span
                              key={mod}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600"
                            >
                              {moduleInfo?.label ?? mod}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openEdit(member)}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="邀请成员"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setInviteOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleInvite}
              disabled={
                inviting || !inviteForm.name.trim() || !inviteForm.email.trim()
              }
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {inviting ? '添加中...' : '添加'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
            注意：此处仅创建用户资料。登录账号需在 Supabase Dashboard 中单独创建，或由用户通过邀请链接注册。
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              姓名
            </label>
            <input
              type="text"
              value={inviteForm.name}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, name: e.target.value })
              }
              placeholder="请输入姓名"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              邮箱
            </label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, email: e.target.value })
              }
              placeholder="请输入邮箱地址"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              角色
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, role: e.target.value as Role })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingMember(null);
        }}
        title={`编辑成员 - ${editingMember?.name ?? ''}`}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditOpen(false);
                setEditingMember(null);
              }}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              角色
            </label>
            <select
              value={editForm.role}
              onChange={(e) =>
                setEditForm({ ...editForm, role: e.target.value as Role })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              管理板块
            </label>
            <div className="space-y-2">
              {allModules.map((mod) => (
                <label
                  key={mod.key}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={editForm.managed_modules.includes(mod.key)}
                    onChange={() => toggleModule(mod.key)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{mod.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="权限交接"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setTransferOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleTransfer}
              disabled={
                transferring ||
                !transferForm.module ||
                !transferForm.newUserId
              }
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {transferring ? '交接中...' : '确认交接'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              选择板块
            </label>
            <select
              value={transferForm.module}
              onChange={(e) => handleModuleChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">请选择板块</option>
              {allModules.map((mod) => (
                <option key={mod.key} value={mod.key}>
                  {mod.label}
                </option>
              ))}
            </select>
          </div>

          {transferForm.module && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  当前负责人
                </label>
                <div className="px-3.5 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
                  {currentTransferOwner?.name ?? '暂无'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  新负责人
                </label>
                <select
                  value={transferForm.newUserId}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      newUserId: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">请选择新负责人</option>
                  {members
                    .filter((m) => m.id !== transferForm.currentUserId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({roleLabels[m.role]})
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
