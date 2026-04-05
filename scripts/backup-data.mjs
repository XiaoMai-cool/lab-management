/**
 * 数据库备份脚本
 * 将 Supabase 中所有表的数据导出为 JSON 文件，保存到 backups/ 目录
 *
 * 使用方法：
 *   node scripts/backup-data.mjs
 *
 * 也可以由 GitHub Actions 自动定期运行（通过环境变量传入 SUPABASE_SERVICE_KEY）
 */

const SUPABASE_URL = 'https://lzvhbudvzzigwqysyzha.supabase.co';
// 优先用环境变量（GitHub Actions），否则用默认值（本地运行）
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('❌ 请设置环境变量 SUPABASE_SERVICE_KEY');
  console.error('   用法: SUPABASE_SERVICE_KEY=你的key node scripts/backup-data.mjs');
  process.exit(1);
}

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, '..', 'backups');

// 需要备份的所有表
const TABLES = [
  'profiles',
  'announcements',
  'daily_notices',
  'documents',
  'supply_categories',
  'supplies',
  'supply_reservations',
  'supply_reservation_items',
  'supply_borrowings',
  'chemicals',
  'chemical_usage_logs',
  'chemical_purchases',
  'chemical_warnings',
  'duty_roster',
  'duty_config',
  'duty_overrides',
  'equipment',
  'meetings',
  'meeting_reports',
  'reimbursements',
  'purchase_logs',
  'purchase_approvals',
  'purchases',
  'student_teacher_assignments',
  'reagent_lists',
];

async function fetchAllRows(table) {
  // Supabase REST API 默认最多返回 1000 行，用分页获取全部
  const allRows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      // 表可能不存在（还没运行对应的 migration），跳过
      if (res.status === 404 || err.includes('does not exist')) {
        return null;
      }
      console.error(`  获取 ${table} 失败:`, err);
      return null;
    }

    const rows = await res.json();
    allRows.push(...rows);

    if (rows.length < limit) break;
    offset += limit;
  }

  return allRows;
}

async function main() {
  console.log('🔄 开始备份数据库...\n');

  // 创建按日期命名的备份文件夹
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // 2026-04-05
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, ''); // 143025
  const folderName = `${dateStr}_${timeStr}`;
  const backupPath = join(BACKUP_DIR, folderName);
  mkdirSync(backupPath, { recursive: true });

  const summary = {};
  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`  备份 ${table}...`);
    const rows = await fetchAllRows(table);

    if (rows === null) {
      console.log(' ⏭️  表不存在，跳过');
      continue;
    }

    const filePath = join(backupPath, `${table}.json`);
    writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(` ✅ ${rows.length} 条记录`);
    summary[table] = rows.length;
    totalRows += rows.length;
  }

  // 写一个摘要文件
  const summaryContent = {
    backup_time: now.toISOString(),
    total_tables: Object.keys(summary).length,
    total_rows: totalRows,
    tables: summary,
  };
  writeFileSync(
    join(backupPath, '_summary.json'),
    JSON.stringify(summaryContent, null, 2),
    'utf-8'
  );

  console.log(`\n✅ 备份完成！`);
  console.log(`   📁 保存位置: backups/${folderName}/`);
  console.log(`   📊 共 ${Object.keys(summary).length} 张表，${totalRows} 条记录`);
}

main().catch(console.error);
