import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_STORAGE_MB = 1024; // 1GB free tier

export default function StorageUsage() {
  const [usedMB, setUsedMB] = useState<number | null>(null);

  useEffect(() => {
    calculateUsage();
  }, []);

  async function calculateUsage() {
    // 注意：新增存储文件夹时需同步更新此列表
    const folders = ['announcements', 'documents', 'editor', 'reimbursements', 'purchases'];
    try {
      const results = await Promise.all(
        folders.map((folder) => supabase.storage.from('attachments').list(folder, { limit: 1000 }))
      );
      let totalBytes = 0;
      for (const { data } of results) {
        if (data) {
          for (const file of data) {
            totalBytes += file.metadata?.size ?? 0;
          }
        }
      }
      setUsedMB(totalBytes / (1024 * 1024));
    } catch {
      // 查询失败时静默处理，不影响页面
    }
  }

  if (usedMB === null) return null;

  const percentage = Math.min((usedMB / MAX_STORAGE_MB) * 100, 100);
  const isWarning = percentage > 80;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isWarning ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
      <HardDrive className="w-3.5 h-3.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span>存储空间</span>
          <span>{usedMB.toFixed(1)} MB / {MAX_STORAGE_MB} MB</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
