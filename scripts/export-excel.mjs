/**
 * 每周自动导出 Excel 数据
 * 将关键业务数据导出为 .xlsx 文件，保存到 exports/ 目录
 *
 * 使用方法：
 *   SUPABASE_SERVICE_KEY=xxx node scripts/export-excel.mjs
 */

import XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = join(__dirname, '..', 'exports');

const SUPABASE_URL = 'https://lzvhbudvzzigwqysyzha.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('❌ 请设置环境变量 SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// 需要导出的数据及中文列名映射
const EXPORT_CONFIGS = [
  {
    name: '耗材库存',
    table: 'supplies',
    select: 'name, specification, stock, unit, min_stock, updated_at, supply_categories(name)',
    orderBy: 'updated_at',
    columns: {
      name: '耗材名称',
      specification: '规格',
      stock: '库存数量',
      unit: '单位',
      min_stock: '最低库存',
      category_name: '分类',
      updated_at: '更新时间',
    },
    transform: (rows) =>
      rows.map((r) => ({
        ...r,
        category_name: r.supply_categories?.name ?? '',
        supply_categories: undefined,
      })),
  },
  {
    name: '试剂药品',
    table: 'chemicals',
    select: 'name, cas_number, specification, stock, unit, location, updated_at',
    orderBy: 'updated_at',
    columns: {
      name: '药品名称',
      cas_number: 'CAS号',
      specification: '规格',
      stock: '库存数量',
      unit: '单位',
      location: '存放位置',
      updated_at: '更新时间',
    },
  },
  {
    name: '耗材领用记录',
    table: 'supply_reservations',
    select: 'quantity, purpose, status, is_returnable, created_at, reviewed_at, profiles!supply_reservations_user_id_fkey(name)',
    columns: {
      user_name: '领用人',
      quantity: '数量',
      purpose: '用途',
      status: '状态',
      is_returnable: '是否需归还',
      created_at: '申请时间',
      reviewed_at: '审核时间',
    },
    transform: (rows) =>
      rows.map((r) => ({
        ...r,
        user_name: r.profiles?.name ?? '',
        is_returnable: r.is_returnable ? '是' : '否',
        status: { pending: '待审核', approved: '已批准', rejected: '已拒绝', completed: '已完成' }[r.status] ?? r.status,
        profiles: undefined,
      })),
  },
  {
    name: '采购申请',
    table: 'purchases',
    select: 'title, category, purchase_type, estimated_amount, actual_amount, description, approval_status, reimbursement_status, created_at, profiles!purchases_applicant_id_fkey(name)',
    columns: {
      user_name: '申请人',
      title: '标题',
      category: '类别',
      purchase_type: '采购类型',
      estimated_amount: '预估金额',
      actual_amount: '实际金额',
      description: '说明',
      approval_status: '审批状态',
      reimbursement_status: '报销状态',
      created_at: '申请时间',
    },
    transform: (rows) =>
      rows.map((r) => ({
        ...r,
        user_name: r.profiles?.name ?? '',
        purchase_type: r.purchase_type === 'personal' ? '个人采购' : '公共采购',
        approval_status: { pending: '待审批', approved: '已批准', rejected: '已拒绝' }[r.approval_status] ?? r.approval_status,
        reimbursement_status: r.reimbursement_status
          ? ({ pending: '待审批', approved: '已批准', rejected: '已拒绝' }[r.reimbursement_status] ?? r.reimbursement_status)
          : '未报销',
        profiles: undefined,
      })),
  },
  {
    name: '药品使用记录',
    table: 'chemical_usage_logs',
    select: 'amount, unit, purpose, used_at, chemicals(name), profiles!chemical_usage_logs_user_id_fkey(name)',
    orderBy: 'used_at',
    columns: {
      chemical_name: '药品名称',
      user_name: '使用人',
      amount: '用量',
      unit: '单位',
      purpose: '用途',
      used_at: '使用时间',
    },
    transform: (rows) =>
      rows.map((r) => ({
        ...r,
        chemical_name: r.chemicals?.name ?? '',
        user_name: r.profiles?.name ?? '',
        chemicals: undefined,
        profiles: undefined,
      })),
  },
];

async function fetchAllRows(table, select = '*', orderBy = 'created_at') {
  const allRows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${orderBy}.desc.nullslast&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 404 || err.includes('does not exist')) return null;
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

function renameColumns(rows, columnMap) {
  return rows.map((row) => {
    const renamed = {};
    for (const [key, label] of Object.entries(columnMap)) {
      if (key in row) {
        renamed[label] = row[key];
      }
    }
    return renamed;
  });
}

async function main() {
  console.log('📊 开始导出 Excel 数据...\n');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const folderName = dateStr;
  const exportPath = join(EXPORTS_DIR, folderName);
  mkdirSync(exportPath, { recursive: true });

  for (const config of EXPORT_CONFIGS) {
    process.stdout.write(`  导出 ${config.name}...`);

    let rows = await fetchAllRows(config.table, config.select, config.orderBy || 'created_at');
    if (rows === null) {
      console.log(' ⏭️  表不存在，跳过');
      continue;
    }

    if (config.transform) {
      rows = config.transform(rows);
    }

    // 删除 undefined 字段
    rows = rows.map((r) => {
      const clean = {};
      for (const [k, v] of Object.entries(r)) {
        if (v !== undefined) clean[k] = v;
      }
      return clean;
    });

    const renamedRows = renameColumns(rows, config.columns);

    let ws;
    if (renamedRows.length === 0) {
      // 空表也显示表头
      const headers = Object.values(config.columns);
      ws = XLSX.utils.aoa_to_sheet([headers]);
    } else {
      ws = XLSX.utils.json_to_sheet(renamedRows);
      // 自动列宽
      const headers = Object.keys(renamedRows[0]);
      ws['!cols'] = headers.map((h) => {
        const maxLen = Math.max(
          h.length * 2, // 中文字符宽度
          ...renamedRows.map((row) => {
            const val = row[h];
            return val === null || val === undefined ? 0 : String(val).length;
          })
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.name);

    const filePath = join(exportPath, `${config.name}.xlsx`);
    XLSX.writeFile(wb, filePath);
    console.log(` ✅ ${rows.length} 条记录`);
  }

  console.log(`\n✅ 导出完成！`);
  console.log(`   📁 保存位置: exports/${folderName}/`);
}

main().catch(console.error);
