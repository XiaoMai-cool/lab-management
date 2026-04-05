/**
 * 数据库恢复脚本
 * 从 backups/ 目录中的 JSON 文件恢复数据到 Supabase
 *
 * 使用方法：
 *   node scripts/restore-data.mjs backups/2026-04-05_143025
 *
 * ⚠️ 注意：这会用备份数据覆盖当前数据库中的数据！
 */

const SUPABASE_URL = 'https://lzvhbudvzzigwqysyzha.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('❌ 请设置环境变量 SUPABASE_SERVICE_KEY');
  console.error('   用法: SUPABASE_SERVICE_KEY=你的key node scripts/restore-data.mjs backups/文件夹名');
  process.exit(1);
}

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// 恢复顺序很重要：先恢复被其他表引用的表
const RESTORE_ORDER = [
  'profiles',
  'supply_categories',
  'supplies',
  'chemicals',
  'equipment',
  'announcements',
  'daily_notices',
  'documents',
  'duty_config',
  'duty_roster',
  'duty_overrides',
  'meetings',
  'meeting_reports',
  'supply_reservations',
  'supply_reservation_items',
  'supply_borrowings',
  'chemical_usage_logs',
  'chemical_purchases',
  'chemical_warnings',
  'reimbursements',
  'purchase_logs',
  'purchase_approvals',
  'purchases',
  'student_teacher_assignments',
  'reagent_lists',
];

async function upsertRows(table, rows) {
  if (rows.length === 0) return true;

  // 分批上传，每批 100 条
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`\n  批次 ${i}-${i + batch.length} 失败:`, err);
      return false;
    }
  }
  return true;
}

async function main() {
  const backupPath = process.argv[2];

  if (!backupPath) {
    console.error('❌ 请指定备份文件夹路径');
    console.error('   用法: node scripts/restore-data.mjs backups/2026-04-05_143025');

    // 列出可用的备份
    const backupsDir = join(import.meta.dirname || '.', '..', 'backups');
    if (existsSync(backupsDir)) {
      const dirs = readdirSync(backupsDir).filter(d => !d.startsWith('.'));
      if (dirs.length > 0) {
        console.error('\n   可用的备份:');
        dirs.forEach(d => console.error(`     backups/${d}`));
      }
    }
    process.exit(1);
  }

  if (!existsSync(backupPath)) {
    console.error(`❌ 备份文件夹不存在: ${backupPath}`);
    process.exit(1);
  }

  // 读取摘要
  const summaryPath = join(backupPath, '_summary.json');
  if (existsSync(summaryPath)) {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    console.log(`📋 备份信息:`);
    console.log(`   时间: ${summary.backup_time}`);
    console.log(`   表数: ${summary.total_tables}`);
    console.log(`   记录: ${summary.total_rows} 条\n`);
  }

  console.log('⚠️  即将用备份数据覆盖当前数据库，3 秒后开始...\n');
  await new Promise(r => setTimeout(r, 3000));

  console.log('🔄 开始恢复数据...\n');

  for (const table of RESTORE_ORDER) {
    const filePath = join(backupPath, `${table}.json`);
    if (!existsSync(filePath)) {
      console.log(`  ⏭️  ${table} - 无备份文件，跳过`);
      continue;
    }

    const rows = JSON.parse(readFileSync(filePath, 'utf-8'));
    process.stdout.write(`  恢复 ${table} (${rows.length} 条)...`);

    const ok = await upsertRows(table, rows);
    if (ok) {
      console.log(' ✅');
    } else {
      console.log(' ❌ 部分失败');
    }
  }

  console.log('\n✅ 恢复完成！');
}

main().catch(console.error);
