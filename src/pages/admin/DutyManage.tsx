import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { ArrowUp, ArrowDown, Trash2, Plus, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { DutyConfig, DutyOverride } from '../../lib/dutyCalculation';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ProfileOption {
  id: string;
  name: string;
}

export default function DutyManage() {
  const { isDutyManager, isAdmin } = useAuth();
  const canManage = isDutyManager || isAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  // Lab config
  const [labPeople, setLabPeople] = useState<string[]>([]);
  const [labRotation, setLabRotation] = useState(4);
  const [labRefDate, setLabRefDate] = useState('2026-03-30');
  const [labAddName, setLabAddName] = useState('');

  // Office config
  const [officePeople, setOfficePeople] = useState<string[]>([]);
  const [officeRotation, setOfficeRotation] = useState(1);
  const [officeRefDate, setOfficeRefDate] = useState('2026-03-01');
  const [officeAddName, setOfficeAddName] = useState('');

  // Overrides
  const [overrides, setOverrides] = useState<DutyOverride[]>([]);
  const [labOverrideDate, setLabOverrideDate] = useState('');
  const [labOverridePeople, setLabOverridePeople] = useState<string[]>(['', '', '', '', '']);
  const [officeOverrideDate, setOfficeOverrideDate] = useState('');
  const [officeOverridePerson, setOfficeOverridePerson] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [configRes, overrideRes, profileRes] = await Promise.all([
        supabase.from('duty_config').select('*'),
        supabase.from('duty_overrides').select('*').order('target_date', { ascending: false }),
        supabase.from('profiles').select('id, name').neq('email', 'fengfamily@lab').order('name'),
      ]);

      if (configRes.data) {
        const labConfig = configRes.data.find((c: DutyConfig & { id?: string }) => c.type === 'lab');
        const officeConfig = configRes.data.find((c: DutyConfig & { id?: string }) => c.type === 'office');
        if (labConfig) {
          setLabPeople(labConfig.people || []);
          setLabRotation(labConfig.rotation_period || 4);
          setLabRefDate(labConfig.ref_date || '2026-03-30');
        }
        if (officeConfig) {
          setOfficePeople(officeConfig.people || []);
          setOfficeRotation(officeConfig.rotation_period || 1);
          setOfficeRefDate(officeConfig.ref_date || '2026-03-01');
        }
      }

      if (overrideRes.data) {
        setOverrides(overrideRes.data as DutyOverride[]);
      }

      if (profileRes.data) {
        setProfiles(profileRes.data as ProfileOption[]);
      }
    } catch (err) {
      console.error('Failed to fetch duty config:', err);
    } finally {
      setLoading(false);
    }
  }

  // People list helpers
  function movePerson(list: string[], index: number, direction: 'up' | 'down'): string[] {
    const newList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return newList;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    return newList;
  }

  function removePerson(list: string[], index: number): string[] {
    return list.filter((_, i) => i !== index);
  }

  // Save config
  async function saveConfig(type: 'lab' | 'office') {
    if (!canManage) return;
    setSaving(true);
    try {
      const config = type === 'lab'
        ? { type: 'lab', people: labPeople, rotation_period: labRotation, ref_date: labRefDate }
        : { type: 'office', people: officePeople, rotation_period: officeRotation, ref_date: officeRefDate };

      const { error } = await supabase
        .from('duty_config')
        .upsert(config, { onConflict: 'type' });

      if (error) throw error;
      alert('保存成功');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  // Add override
  async function addLabOverride() {
    if (!labOverrideDate || labOverridePeople.some((p) => !p)) {
      alert('请填写完整的日期和人员');
      return;
    }
    // Ensure it's a Monday
    const d = dayjs(labOverrideDate);
    if (d.day() !== 1) {
      alert('请选择一个周一的日期');
      return;
    }
    try {
      const { error } = await supabase
        .from('duty_overrides')
        .upsert(
          { type: 'lab', target_date: labOverrideDate, people: labOverridePeople },
          { onConflict: 'type,target_date' },
        );
      if (error) throw error;
      setLabOverrideDate('');
      setLabOverridePeople(['', '', '', '', '']);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败');
    }
  }

  async function addOfficeOverride() {
    if (!officeOverrideDate || !officeOverridePerson) {
      alert('请填写完整的日期和人员');
      return;
    }
    try {
      // target_date should be first of month
      const firstOfMonth = dayjs(officeOverrideDate + '-01').format('YYYY-MM-DD');
      const { error } = await supabase
        .from('duty_overrides')
        .upsert(
          { type: 'office', target_date: firstOfMonth, people: [officeOverridePerson] },
          { onConflict: 'type,target_date' },
        );
      if (error) throw error;
      setOfficeOverrideDate('');
      setOfficeOverridePerson('');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败');
    }
  }

  async function deleteOverride(id: string) {
    if (!confirm('确定删除此覆盖？')) return;
    try {
      const { error } = await supabase.from('duty_overrides').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  }

  if (!canManage) {
    return (
      <div className="p-6 text-center text-gray-500">
        无权限访问此页面
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  const availableForLab = profiles.filter((p) => !labPeople.includes(p.name));
  const availableForOffice = profiles.filter((p) => !officePeople.includes(p.name));
  const allNames = profiles.map((p) => p.name);
  const dayLabels = ['周一', '周二', '周三', '周四', '周五'];

  return (
    <div className="pb-8">
      <PageHeader title="值日管理" subtitle="配置实验室和办公室值日排班" />

      <div className="px-4 md:px-6 space-y-6">
        {/* 实验室值日设置 */}
        <Card title="实验室值日设置">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">人员顺序</label>
              <div className="space-y-2">
                {labPeople.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{name}</span>
                    <button
                      onClick={() => setLabPeople(movePerson(labPeople, i, 'up'))}
                      disabled={i === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setLabPeople(movePerson(labPeople, i, 'down'))}
                      disabled={i === labPeople.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setLabPeople(removePerson(labPeople, i))}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {availableForLab.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={labAddName}
                    onChange={(e) => setLabAddName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">选择人员...</option>
                    {availableForLab.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (labAddName) {
                        setLabPeople([...labPeople, labAddName]);
                        setLabAddName('');
                      }
                    }}
                    disabled={!labAddName}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    添加
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">轮换周期（周）</label>
                <input
                  type="number"
                  min={1}
                  value={labRotation}
                  onChange={(e) => setLabRotation(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">起始日期</label>
                <input
                  type="date"
                  value={labRefDate}
                  onChange={(e) => setLabRefDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => saveConfig('lab')}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </Card>

        {/* 办公室值日设置 */}
        <Card title="办公室值日设置">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">人员顺序</label>
              <div className="space-y-2">
                {officePeople.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{name}</span>
                    <button
                      onClick={() => setOfficePeople(movePerson(officePeople, i, 'up'))}
                      disabled={i === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setOfficePeople(movePerson(officePeople, i, 'down'))}
                      disabled={i === officePeople.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setOfficePeople(removePerson(officePeople, i))}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {availableForOffice.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={officeAddName}
                    onChange={(e) => setOfficeAddName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">选择人员...</option>
                    {availableForOffice.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (officeAddName) {
                        setOfficePeople([...officePeople, officeAddName]);
                        setOfficeAddName('');
                      }
                    }}
                    disabled={!officeAddName}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    添加
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">轮换周期（月）</label>
                <input
                  type="number"
                  min={1}
                  value={officeRotation}
                  onChange={(e) => setOfficeRotation(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">起始日期</label>
                <input
                  type="date"
                  value={officeRefDate}
                  onChange={(e) => setOfficeRefDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => saveConfig('office')}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </Card>

        {/* 手动覆盖 */}
        <Card title="手动覆盖">
          <div className="space-y-6">
            {/* Lab override */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">实验室覆盖（选择周一日期）</h4>
              <div className="space-y-3">
                <input
                  type="date"
                  value={labOverrideDate}
                  onChange={(e) => setLabOverrideDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="选择周一"
                />
                {labOverrideDate && (
                  <div className="grid grid-cols-5 gap-2">
                    {dayLabels.map((label, i) => (
                      <div key={label}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <select
                          value={labOverridePeople[i]}
                          onChange={(e) => {
                            const newPeople = [...labOverridePeople];
                            newPeople[i] = e.target.value;
                            setLabOverridePeople(newPeople);
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                        >
                          <option value="">选择</option>
                          {allNames.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={addLabOverride}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加实验室覆盖
                </button>
              </div>
            </div>

            {/* Office override */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">办公室覆盖（选择月份）</h4>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">月份</label>
                  <input
                    type="month"
                    value={officeOverrideDate}
                    onChange={(e) => setOfficeOverrideDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">负责人</label>
                  <select
                    value={officeOverridePerson}
                    onChange={(e) => setOfficeOverridePerson(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">选择</option>
                    {allNames.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addOfficeOverride}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  添加
                </button>
              </div>
            </div>

            {/* Existing overrides */}
            {overrides.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">已有覆盖</h4>
                <div className="space-y-2">
                  {overrides.map((o) => (
                    <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-gray-500 mr-2">
                          {o.type === 'lab' ? '实验室' : '办公室'}
                        </span>
                        <span className="text-sm text-gray-900">
                          {dayjs(o.target_date).format('YYYY-MM-DD')}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {o.people.join(', ')}
                        </span>
                      </div>
                      <button
                        onClick={() => o.id && deleteOverride(o.id)}
                        className="p-1 text-red-400 hover:text-red-600 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
