import { useEffect, useState } from 'react';
import { Plus, Pencil, ArrowRightLeft, Users, Shield, KeyRound, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
  { key: 'members', label: '人员管理' },
];

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const defaultCreateForm: CreateForm = {
  name: '',
  email: '',
  password: '',
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
  const { isAdmin, canManageModule } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreateForm);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ role: 'student', managed_modules: [] });
  const [saving, setSaving] = useState(false);

  // Reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>({ module: '', currentUserId: '', newUserId: '' });
  const [transferring, setTransferring] = useState(false);

  const canManageMembers = isAdmin || canManageModule('members');

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
    } else {
      setMembers(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchMembers(); }, []);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  // ---- Create user ----
  async function handleCreate() {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) return;
    if (createForm.password.length < 6) {
      setError('密码至少6位');
      return;
    }
    setCreating(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('create_lab_user', {
        user_email: createForm.email.trim(),
        user_password: createForm.password,
        user_name: createForm.name.trim(),
        user_role: createForm.role,
        user_modules: [],
      });

      if (rpcError) throw rpcError;

      setCreateOpen(false);
      setCreateForm(defaultCreateForm);
      showSuccess(`已创建账号：${createForm.name}（${createForm.email}）`);
      fetchMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败';
      if (msg.includes('Email already exists')) {
        setError('该邮箱已被注册');
      } else if (msg.includes('Permission denied')) {
        setError('没有权限创建账号');
      } else {
        setError(msg);
      }
    } finally {
      setCreating(false);
    }
  }

  // ---- Edit role/modules ----
  function openEdit(member: Profile) {
    setEditingMember(member);
    setEditForm({ role: member.role, managed_modules: member.managed_modules ?? [] });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingMember) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: editForm.role, managed_modules: editForm.managed_modules })
        .eq('id', editingMember.id);
      if (updateError) throw updateError;
      setEditOpen(false);
      setEditingMember(null);
      showSuccess('已更新');
      fetchMembers();
    } catch {
      setError('保存失败');
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

  // ---- Reset password ----
  function openReset(member: Profile) {
    setResetTarget(member);
    setNewPassword('');
    setResetOpen(true);
  }

  async function handleResetPassword() {
    if (!resetTarget || !newPassword || newPassword.length < 6) {
      setError('密码至少6位');
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('reset_user_password', {
        target_user_id: resetTarget.id,
        new_password: newPassword,
      });
      if (rpcError) throw rpcError;
      setResetOpen(false);
      setResetTarget(null);
      showSuccess(`已重置 ${resetTarget.name} 的密码`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setResetting(false);
    }
  }

  // ---- Delete user ----
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('delete_lab_user', {
        target_user_id: deleteTarget.id,
      });
      if (rpcError) throw rpcError;
      setDeleteTarget(null);
      showSuccess(`已删除 ${deleteTarget.name}`);
      fetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }

  // ---- Transfer ----
  function handleModuleChange(module: string) {
    const currentManager = members.find((m) => m.managed_modules?.includes(module));
    setTransferForm({ module, currentUserId: currentManager?.id ?? '', newUserId: '' });
  }

  async function handleTransfer() {
    if (!transferForm.module || !transferForm.newUserId) return;
    setTransferring(true);
    try {
      if (transferForm.currentUserId) {
        const current = members.find((m) => m.id === transferForm.currentUserId);
        if (current) {
          await supabase.from('profiles').update({
            managed_modules: (current.managed_modules ?? []).filter((m) => m !== transferForm.module),
          }).eq('id', current.id);
        }
      }
      const newOwner = members.find((m) => m.id === transferForm.newUserId);
      if (newOwner) {
        await supabase.from('profiles').update({
          managed_modules: [...(newOwner.managed_modules ?? []).filter((m) => m !== transferForm.module), transferForm.module],
        }).eq('id', newOwner.id);
      }
      setTransferOpen(false);
      showSuccess('权限交接成功');
      fetchMembers();
    } catch {
      setError('权限交接失败');
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
            {isAdmin && (
              <button
                onClick={() => { setTransferForm({ module: '', currentUserId: '', newUserId: '' }); setTransferOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="hidden sm:inline">权限交接</span>
              </button>
            )}
            {canManageMembers && (
              <button
                onClick={() => { setCreateForm(defaultCreateForm); setCreateOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加账号
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 md:px-6 pb-6">
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">关闭</button>
          </div>
        )}

        {members.length === 0 ? (
          <EmptyState icon={Users} title="暂无成员" description="点击右上角按钮添加账号" />
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{member.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                        {roleLabels[member.role]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{member.email}</p>
                    {member.managed_modules && member.managed_modules.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {member.managed_modules.map((mod) => {
                          const moduleInfo = allModules.find((m) => m.key === mod);
                          return (
                            <span key={mod} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">
                              {moduleInfo?.label ?? mod}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {canManageMembers && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(member)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="编辑角色">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => openReset(member)} className="p-2 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors" title="重置密码">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {isAdmin && member.role !== 'super_admin' && (
                        <button onClick={() => setDeleteTarget(member)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="删除账号">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加账号 Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="添加账号"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? '创建中...' : '创建账号'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="请输入姓名"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱（用于登录）</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="请输入邮箱地址"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">初始密码</label>
            <input
              type="text"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="至少6位，建议告知成员后自行修改"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="student">学生</option>
              <option value="teacher">教师</option>
              <option value="manager">板块负责人</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* 编辑角色 Modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingMember(null); }}
        title={`编辑 - ${editingMember?.name ?? ''}`}
        footer={
          <div className="flex gap-3">
            <button onClick={() => { setEditOpen(false); setEditingMember(null); }} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">管理板块</label>
            <div className="space-y-2">
              {allModules.map((mod) => (
                <label key={mod.key} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={editForm.managed_modules.includes(mod.key)} onChange={() => toggleModule(mod.key)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{mod.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 重置密码 Modal */}
      <Modal
        open={resetOpen}
        onClose={() => { setResetOpen(false); setResetTarget(null); }}
        title={`重置密码 - ${resetTarget?.name ?? ''}`}
        footer={
          <div className="flex gap-3">
            <button onClick={() => { setResetOpen(false); setResetTarget(null); }} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button onClick={handleResetPassword} disabled={resetting || !newPassword || newPassword.length < 6} className="flex-1 py-2.5 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors">
              {resetting ? '重置中...' : '确认重置'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-xs text-yellow-700">
            重置后请将新密码告知 {resetTarget?.name}，建议其登录后自行修改。
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少6位"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">
          确定要删除 <strong>{deleteTarget?.name}</strong>（{deleteTarget?.email}）的账号吗？此操作不可撤销，该用户的所有数据将被清除。
        </div>
      </Modal>

      {/* 权限交接 Modal */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="权限交接"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setTransferOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button onClick={handleTransfer} disabled={transferring || !transferForm.module || !transferForm.newUserId} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {transferring ? '交接中...' : '确认交接'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">选择板块</label>
            <select value={transferForm.module} onChange={(e) => handleModuleChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">请选择板块</option>
              {allModules.map((mod) => (
                <option key={mod.key} value={mod.key}>{mod.label}</option>
              ))}
            </select>
          </div>
          {transferForm.module && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">当前负责人</label>
                <div className="px-3.5 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
                  {currentTransferOwner?.name ?? '暂无'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">新负责人</label>
                <select value={transferForm.newUserId} onChange={(e) => setTransferForm({ ...transferForm, newUserId: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">请选择新负责人</option>
                  {members.filter((m) => m.id !== transferForm.currentUserId).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}（{roleLabels[m.role]}）</option>
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
