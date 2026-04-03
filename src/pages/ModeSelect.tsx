import { useNavigate } from 'react-router-dom';
import { FlaskConical, Beaker, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMode } from '../contexts/ModeContext';

export default function ModeSelect() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { setMode } = useMode();

  function choose(mode: 'use' | 'manage') {
    setMode(mode);
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4">
            <FlaskConical className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            你好，{profile?.name || '用户'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">请选择进入方式</p>
        </div>

        {/* Mode Cards */}
        <div className="space-y-4">
          <button
            onClick={() => choose('use')}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Beaker className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">使用模式</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  申领物资、借用耗材、查看药品、提交报销
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => choose('manage')}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-orange-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                <Settings className="w-7 h-7 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">管理模式</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  审批、库存管理、报销统计、系统设置
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          可随时在右上角切换模式
        </p>
      </div>
    </div>
  );
}
