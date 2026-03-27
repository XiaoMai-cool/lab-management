import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Layers,
  Calendar,
  Receipt,
  FileText,
  FlaskConical,
  Lock,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

const ROLE_LABELS: Record<Role, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '模块负责人',
  teacher: '教师',
  student: '学生',
};

const MODULE_LABELS: Record<string, string> = {
  supplies: '物资管理',
  chemicals: '化学品管理',
  duty: '值日排班',
  meetings: '组会管理',
  reimbursements: '报销管理',
  documents: '文档管理',
};

export default function ProfilePage() {
  const { profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleChangePassword() {
    setPasswordError(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次密码不一致');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await signOut();
      navigate('/login');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '退出失败');
      setLoggingOut(false);
    }
  }

  if (authLoading) return <LoadingSpinner />;

  if (!profile) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg text-sm">
          请先登录
        </div>
      </div>
    );
  }

  const quickLinks = [
    {
      label: '我的预约',
      icon: Calendar,
      path: '/supplies/my-reservations',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: '我的借用',
      icon: Calendar,
      path: '/supplies/my-returns',
      color: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: '我的报销',
      icon: Receipt,
      path: '/reimbursements',
      color: 'text-green-600 bg-green-50',
    },
    {
      label: '我的汇报',
      icon: FileText,
      path: '/meetings/report',
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: '试剂台账',
      icon: FlaskConical,
      path: '/reagents/my-ledger',
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: '药品使用登记',
      icon: FlaskConical,
      path: '/chemicals/log',
      color: 'text-pink-600 bg-pink-50',
    },
  ];

  return (
    <div className="pb-8">
      <PageHeader title="个人中心" />

      <div className="px-4 md:px-6 space-y-4">
        {/* 用户信息 */}
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-blue-600">
                  {profile.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {profile.name}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full mt-1">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{profile.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>
            {profile.managed_modules && profile.managed_modules.length > 0 && (
              <div className="flex items-start gap-3 text-sm">
                <Layers className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex flex-wrap gap-1.5">
                  {profile.managed_modules.map((mod) => (
                    <span
                      key={mod}
                      className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full"
                    >
                      {MODULE_LABELS[mod] ?? mod}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 快捷入口 */}
        <Card title="快捷入口">
          <div className="space-y-1">
            {quickLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="w-full flex items-center gap-3 p-3 -mx-1 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${link.color}`}
                >
                  <link.icon className="w-4.5 h-4.5" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-700">
                  {link.label}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </Card>

        {/* 操作 */}
        <Card>
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordError(null);
                setPasswordSuccess(false);
                setNewPassword('');
                setConfirmPassword('');
              }}
              className="w-full flex items-center gap-3 p-3 -mx-1 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-50 text-yellow-600">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700">
                修改密码
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 p-3 -mx-1 rounded-lg hover:bg-red-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 text-red-600">
                <LogOut className="w-4.5 h-4.5" />
              </div>
              <span className="flex-1 text-sm font-medium text-red-600">
                {loggingOut ? '退出中...' : '退出登录'}
              </span>
            </button>
          </div>
        </Card>
      </div>

      {/* 修改密码 Modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="修改密码"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleChangePassword}
              disabled={submitting || !newPassword || !confirmPassword}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '修改中...' : '确认修改'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {passwordSuccess && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              密码修改成功！
            </div>
          )}

          {passwordError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {passwordError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新密码
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少6位"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              确认密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
