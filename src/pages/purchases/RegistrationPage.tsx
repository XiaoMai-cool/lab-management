import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Package, CheckCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase, PurchaseCategory } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

const categoryColors: Record<string, string> = {
  '试剂药品': 'bg-purple-50 text-purple-700',
  '实验耗材': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '服装劳保': 'bg-pink-50 text-pink-700',
  '测试加工': 'bg-teal-50 text-teal-700',
  '会议培训': 'bg-indigo-50 text-indigo-700',
  '出版知产': 'bg-blue-50 text-blue-700',
  '办公用品': 'bg-gray-100 text-gray-700',
  '差旅交通': 'bg-amber-50 text-amber-700',
  '邮寄物流': 'bg-emerald-50 text-emerald-700',
  '其他': 'bg-gray-100 text-gray-600',
};

const suppliesCategories: PurchaseCategory[] = [
  '实验耗材',
  '设备配件',
  '服装劳保',
];
const chemicalsCategories: PurchaseCategory[] = ['试剂药品'];

type PurchaseWithApplicant = Omit<Purchase, 'applicant'> & {
  applicant?: { name: string };
};

type TabFilter = 'pending' | 'registered';

export default function RegistrationPage() {
  const { profile, isAdmin, isSuperAdmin, isSuppliesManager, isChemicalsManager } =
    useAuth();
  const [list, setList] = useState<PurchaseWithApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const hasAccess = isAdmin || isSuperAdmin || isSuppliesManager || isChemicalsManager;

  // Determine which categories this user can see
  function getAllowedCategories(): PurchaseCategory[] | null {
    if (isAdmin || isSuperAdmin) return null; // all categories
    const cats: PurchaseCategory[] = [];
    if (isSuppliesManager) cats.push(...suppliesCategories);
    if (isChemicalsManager) cats.push(...chemicalsCategories);
    return cats.length > 0 ? cats : null;
  }

  useEffect(() => {
    if (hasAccess) fetchList();
  }, [hasAccess, tab]);

  async function fetchList() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('purchases')
        .select(
          '*, applicant:profiles!purchases_applicant_id_fkey(name)'
        )
        .eq('approval_status', 'approved')
        .eq('skip_registration', false)
        .order('created_at', { ascending: tab === 'pending' });

      if (tab === 'pending') {
        query = query.is('registration_status', null);
      } else {
        query = query.eq('registration_status', 'registered');
      }

      // Filter by allowed categories
      const allowedCats = getAllowedCategories();
      if (allowedCats) {
        query = query.in('category', allowedCats);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setList((data as PurchaseWithApplicant[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(id: string) {
    if (!profile) return;
    setProcessingId(id);
    try {
      const { error: updateErr } = await supabase
        .from('purchases')
        .update({
          registration_status: 'registered',
          registered_by: profile.id,
          registered_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateErr) throw updateErr;
      fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUnregister(id: string) {
    if (!confirm('确定要删除该入库登记吗？记录将回到待登记列表。')) return;
    setProcessingId(id);
    try {
      const { error: updateErr } = await supabase
        .from('purchases')
        .update({
          registration_status: null,
          registered_by: null,
          registered_at: null,
        })
        .eq('id', id);
      if (updateErr) throw updateErr;
      fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setProcessingId(null);
    }
  }

  if (!hasAccess) {
    return (
      <div className="pb-8">
        <div className="p-4">
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg text-sm">
            仅物资管理员可访问此页面
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="入库登记"
        subtitle={
          tab === 'pending'
            ? `${list.length} 条待登记`
            : `${list.length} 条已登记`
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            加载失败：{error}
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            待登记
          </button>
          <button
            onClick={() => setTab('registered')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'registered'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            已登记
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Package}
            title={
              tab === 'pending'
                ? '采购审批通过后，需要入库的物资会出现在这里'
                : '暂无已登记的采购'
            }
            description={
              tab === 'pending'
                ? ''
                : '还没有登记过采购入库'
            }
          />
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <Card key={item.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            categoryColors[item.category] ??
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.category}
                        </span>
                        {/* Reimbursement status tag */}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.reimbursement_status === 'approved'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.reimbursement_status === 'approved'
                            ? '已报销'
                            : '未报销'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        申请人：{item.applicant?.name ?? '未知'} |{' '}
                        {dayjs(item.created_at).format('YYYY-MM-DD')}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 shrink-0 ml-3">
                      ¥{(item.actual_amount ?? item.estimated_amount ?? 0).toFixed(2)}
                    </p>
                  </div>

                  {item.description && (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {item.description}
                    </p>
                  )}

                  {/* Registration info for registered tab */}
                  {tab === 'registered' && item.registered_at && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span>
                          登记时间：
                          {dayjs(item.registered_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnregister(item.id)}
                        disabled={processingId === item.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {processingId === item.id ? '处理中...' : '删除登记'}
                      </button>
                    </div>
                  )}

                  {/* Register button for pending tab */}
                  {tab === 'pending' && (
                    <div className="pt-1">
                      <button
                        onClick={() => handleRegister(item.id)}
                        disabled={processingId === item.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {processingId === item.id ? '处理中...' : '登记'}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
