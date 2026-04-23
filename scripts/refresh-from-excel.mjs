/**
 * 数据刷新脚本
 * 1. 清空所有测试操作记录（预约/借用/采购/报销/审计日志等）
 * 2. 清空 supplies + chemicals
 * 3. 从最新的 Excel 重新导入 supplies + chemicals
 *
 * 使用：
 *   node scripts/refresh-from-excel.mjs --dry-run                       // 仅解析并打印，不连库
 *   SUPABASE_SERVICE_KEY=xxx node scripts/refresh-from-excel.mjs        // 用 service_role key（推荐，绕过 RLS）
 *   ADMIN_PASSWORD=xxx node scripts/refresh-from-excel.mjs              // 用管理员邮箱密码登录
 *
 * 两个 Excel 文件路径（写死）：
 *   /Users/xiaomai/Desktop/实验室物资管理登记表.xlsx
 *   /Users/xiaomai/Desktop/药品汇总表.xlsx
 */

import xlsx from 'xlsx';

const SUPABASE_URL = 'https://lzvhbudvzzigwqysyzha.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v_0WFndHPZcW44ZE07rsSw_aH0TGha6';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'fengyujie@szu.edu.cn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DRY_RUN = process.argv.includes('--dry-run');

const SUPPLY_XLSX = '/Users/xiaomai/Desktop/实验室物资管理登记表.xlsx';
const CHEMICAL_XLSX = '/Users/xiaomai/Desktop/药品汇总表.xlsx';

// ---------- helpers ----------

// 返回一个 { apikey, bearer } 组合，service_role 时两者都是 service key；
// password 模式下 apikey 是 anon key，bearer 是登录后的 jwt
async function getAuth() {
  if (SERVICE_KEY) {
    return { apikey: SERVICE_KEY, bearer: SERVICE_KEY, mode: 'service_role' };
  }
  if (!ADMIN_PASSWORD) {
    throw new Error(
      '缺少凭证：请设置 SUPABASE_SERVICE_KEY（推荐）或 ADMIN_PASSWORD 环境变量'
    );
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('登录失败: ' + JSON.stringify(data));
  return { apikey: SUPABASE_ANON_KEY, bearer: data.access_token, mode: 'password' };
}

function headers(auth) {
  return {
    apikey: auth.apikey,
    Authorization: `Bearer ${auth.bearer}`,
    'Content-Type': 'application/json',
  };
}

async function deleteAll(token, table) {
  // Supabase REST 需要显式 where 条件，用 id not null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`, {
    method: 'DELETE',
    headers: { ...headers(token), Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const txt = await res.text();
    // 表不存在时忽略
    if (txt.includes('does not exist') || txt.includes('relation')) {
      console.log(`  (跳过: ${table} 不存在)`);
      return 0;
    }
    throw new Error(`DELETE ${table} 失败: ${txt}`);
  }
  return 1;
}

async function insertBatch(token, table, rows, batchSize = 50) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers(token), Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      throw new Error(`INSERT ${table} (batch ${i}) 失败: ${await res.text()}`);
    }
  }
}

async function getCategoryMap(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/supply_categories?select=id,name`, {
    headers: headers(token),
  });
  const rows = await res.json();
  const map = {};
  rows.forEach((c) => (map[c.name] = c.id));
  return map;
}

// 解析库存值：数字直接返回；"/" 表示未盘点（使用上一次记录）；"11+4" 求和；否则 0
function parseStock(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '/' || trimmed === '') return null;
    if (trimmed === '若干') return 1; // 没具体数字，保留 1 避免 0 库存
    if (trimmed.includes('+')) {
      const parts = trimmed.split('+').map((s) => parseFloat(s.trim()));
      if (parts.every((p) => !isNaN(p))) {
        return parts.reduce((a, b) => a + b, 0);
      }
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num)) return num;
  }
  return null;
}

// 从一行中找最后一个有效数值；如果最后一列是 "/"，回退到前面最近的数字
function latestStock(row, startCol) {
  for (let i = row.length - 1; i >= startCol; i--) {
    const v = parseStock(row[i]);
    if (v !== null) return v;
  }
  return 0;
}

// ---------- supplies ----------

function parseSuppliesFromExcel() {
  const wb = xlsx.readFile(SUPPLY_XLSX);

  // 类别 → [{name, specification, stock, unit, min_stock}]
  const out = {
    '非一次性耗材': [],
    '玻璃器皿': [],
    '一次性耗材': [],
    '其他': [],
  };

  // 名称 -> 单位的覆盖（当规格列不包含单位提示时使用）
  const NAME_TO_UNIT = {
    '离心管': '袋',
    '枪头': '盒',
    '滤头': '包',
    '注射器': '支',
    '吸管': '支',
    '自封袋': '袋',
  };
  const PURE_UNIT_RE = /^(个|盒|袋|包|卷|双|台|箱|本|支|张|瓶|只)$/;

  // sheet 结构: row[0]=编号, row[1]=耗材名, row[2]=规格, row[3..]=日期对应库存
  function parseSheet(sheetName, categoryName, defaultUnit = '个') {
    const sheet = wb.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: null, header: 1 });

    let currentName = null;
    // 前三行通常是：标题行 / 表头 / 日期行
    for (let i = 3; i < json.length; i++) {
      const row = json[i];
      if (!row) continue;
      const numCell = row[0];
      const nameCell = row[1];
      const specCell = row[2];

      // 行中没有任何非空内容就跳过
      if ((nameCell === null || nameCell === '') && (specCell === null || specCell === '') && numCell === null) continue;

      // 新物品行：有编号或有新的耗材名
      if (nameCell && typeof nameCell === 'string' && nameCell.trim()) {
        currentName = nameCell.trim();
      }
      if (!currentName) continue;

      // spec 可能为 null（该耗材只有一种规格）或具体规格
      let spec = specCell == null ? '' : String(specCell).trim();

      const stock = latestStock(row, 3);

      // 推断单位 + 清洗规格
      let unit = NAME_TO_UNIT[currentName] || defaultUnit;
      if (spec) {
        if (PURE_UNIT_RE.test(spec)) {
          // 规格列就是单位，本身无具体规格
          unit = spec;
          spec = '';
        } else {
          const paren = spec.match(/[（(][^（()）]*?(个|盒|袋|包|卷|双|台|箱|本|支|张|瓶|只)[）)]/);
          const lead = spec.match(/^(个|盒|袋|包|卷|双|台|箱|本|支|张|瓶|只)/);
          const tail = spec.match(/(个|盒|袋|包|卷|双|台|箱|本|支|张|瓶|只)$/);
          if (paren) unit = paren[1];
          else if (lead) unit = lead[1];
          else if (tail) unit = tail[1];
        }
      }

      // 智能 min_stock：stock > 5 取 2，>= 3 取 1，其他 0
      const min_stock = stock >= 5 ? 2 : stock >= 2 ? 1 : 0;

      out[categoryName].push({
        name: currentName,
        specification: spec,
        stock,
        unit,
        min_stock,
      });
    }
  }

  parseSheet('2.非一次性耗材库存', '非一次性耗材', '个');
  parseSheet('3.玻璃器皿库存', '玻璃器皿', '个');
  parseSheet('4.一次性耗材库存', '一次性耗材', '包');
  parseSheet('5.其他库存', '其他', '个');

  return out;
}

// ---------- chemicals ----------

const GHS_MAP = {
  '硝酸': ['GHS03', 'GHS05'],
  '硫酸': ['GHS05'],
  '盐酸': ['GHS05', 'GHS07'],
  '甲酸': ['GHS02', 'GHS05', 'GHS06'],
  '苯酚': ['GHS05', 'GHS06', 'GHS08'],
  '丙酮': ['GHS02', 'GHS07'],
  '乙醇': ['GHS02'],
  '戊二醛': ['GHS05', 'GHS06', 'GHS09'],
  '30%过氧化氢': ['GHS03', 'GHS05', 'GHS07'],
  '磷酸': ['GHS05'],
  '氨水': ['GHS05', 'GHS07', 'GHS09'],
  '高锰酸钾': ['GHS03', 'GHS05', 'GHS07', 'GHS09'],
  '重铬酸钾标准滴定溶液': ['GHS03', 'GHS05', 'GHS06', 'GHS08', 'GHS09'],
  '异丙醇': ['GHS02', 'GHS07'],
  'N,N-二甲基甲酰胺': ['GHS02', 'GHS07', 'GHS08'],
  '三乙胺': ['GHS02', 'GHS05', 'GHS07'],
  '硫氰酸钾': ['GHS07'],
  '亚硝酸钠': ['GHS03', 'GHS06', 'GHS09'],
  '氯化钡': ['GHS06'],
  '氯霉素': ['GHS08'],
  '乙炔黑': ['GHS02'],
  '三氯乙酸标准溶液': ['GHS05', 'GHS07'],
};

function parseChemicalsFromExcel() {
  const wb = xlsx.readFile(CHEMICAL_XLSX);
  const chems = [];

  // 常规药品表结构：三列一组（A区 / B区 / 上架）
  const regularSheet = wb.Sheets['常规药品'];
  const regularRows = xlsx.utils.sheet_to_json(regularSheet, { defval: null, header: 1 });

  // 表头: 每 4 列一组 (药品名字 / 药品编号 / 数量 / null)
  // 找出所有"药品名字"列的起始位置
  const header = regularRows[0] || [];
  const groupStarts = [];
  header.forEach((cell, idx) => {
    if (cell === '药品名字') groupStarts.push(idx);
  });

  // 根据 batch_number 的前缀推断 location / category
  function inferLoc(code) {
    if (!code) return null;
    if (code.startsWith('A')) return { location: 'A区', category: '普通试剂' };
    if (code.startsWith('B')) return { location: 'B区', category: '普通试剂' };
    if (code.startsWith('上')) return { location: '上架', category: '生物试剂' };
    return null;
  }

  for (let i = 1; i < regularRows.length; i++) {
    const row = regularRows[i] || [];
    for (const start of groupStarts) {
      const name = row[start];
      const code = row[start + 1];
      const qty = row[start + 2];
      if (!name || typeof name !== 'string') continue;
      const trimmedName = name.trim();
      if (!trimmedName) continue;
      const codeStr = (code || '').toString().trim();
      const loc = inferLoc(codeStr);
      if (!loc) continue;
      chems.push({
        name: trimmedName,
        batch_number: codeStr,
        specification: '',
        stock: parseStock(qty) || 1,
        unit: '瓶',
        category: loc.category,
        location: loc.location,
        ghs_labels: GHS_MAP[trimmedName] || [],
      });
    }
  }

  // 冷藏药品
  const coldRows = xlsx.utils.sheet_to_json(wb.Sheets['冷藏药品'], { defval: null, header: 1 });
  for (let i = 1; i < coldRows.length; i++) {
    const row = coldRows[i] || [];
    const name = row[0];
    if (!name || typeof name !== 'string' || !name.trim()) continue;
    chems.push({
      name: name.trim(),
      batch_number: (row[1] || '').toString().trim(),
      specification: '',
      stock: parseStock(row[2]) || 1,
      unit: '瓶',
      category: '生物试剂',
      location: '冷藏',
      ghs_labels: GHS_MAP[name.trim()] || [],
    });
  }

  // 危化品
  const hazRows = xlsx.utils.sheet_to_json(wb.Sheets['危化品'], { defval: null, header: 1 });
  for (let i = 1; i < hazRows.length; i++) {
    const row = hazRows[i] || [];
    const name = row[0];
    if (!name || typeof name !== 'string' || !name.trim()) continue;
    chems.push({
      name: name.trim(),
      batch_number: (row[1] || '').toString().trim(),
      specification: '',
      stock: parseStock(row[2]) || 1,
      unit: '瓶',
      category: '危险化学品',
      location: '危化品柜',
      ghs_labels: GHS_MAP[name.trim()] || [],
    });
  }

  return chems;
}

// ---------- main ----------

async function main() {
  console.log(`=== 实验室数据刷新 ${DRY_RUN ? '(DRY-RUN)' : ''} ===\n`);

  // 解析 Excel 先做，DRY-RUN 只到这一步
  console.log('--- 解析 Excel ---');
  const suppliesByCategory = parseSuppliesFromExcel();
  const chemicals = parseChemicalsFromExcel();
  const totalSupplies = Object.values(suppliesByCategory).flat().length;
  console.log(`耗材总数: ${totalSupplies}`);
  for (const [cat, items] of Object.entries(suppliesByCategory)) {
    console.log(`  ${cat}: ${items.length}`);
    const maxShow = DRY_RUN ? 100 : 3;
    items.slice(0, maxShow).forEach((it) =>
      console.log(`    · ${it.name} | ${it.specification} | 库存 ${it.stock} ${it.unit}`)
    );
  }
  console.log(`药品总数: ${chemicals.length}`);
  const byLoc = {};
  chemicals.forEach((c) => {
    byLoc[c.location] = (byLoc[c.location] || 0) + 1;
  });
  Object.entries(byLoc).forEach(([loc, n]) => console.log(`  ${loc}: ${n}`));
  console.log('');

  if (DRY_RUN) {
    console.log('🟡 DRY-RUN 模式，不写入数据库。去掉 --dry-run 才会真正执行。');
    return;
  }

  const auth = await getAuth();
  console.log(`✅ 登录成功 (${auth.mode})\n`);
  const token = auth;

  // 1. 清空所有操作记录（保留 profiles / announcements / documents / duty_roster 等）
  console.log('--- 清空测试操作记录 ---');
  const opTables = [
    'audit_log',
    'supply_reservation_items',
    'supply_reservations',
    'supply_borrowings',
    'chemical_usage_logs',
    'chemical_purchases',
    'chemical_warnings',
    'purchases',
    'purchase_approvals',
    'reimbursements',
    'purchase_logs',
  ];
  for (const t of opTables) {
    await deleteAll(token, t);
    console.log(`  ✅ 清空 ${t}`);
  }
  console.log('');

  // 2. 清空 supplies + chemicals
  console.log('--- 清空耗材 / 药品 ---');
  await deleteAll(token, 'supplies');
  console.log('  ✅ 清空 supplies');
  await deleteAll(token, 'chemicals');
  console.log('  ✅ 清空 chemicals\n');

  // 3. 重新导入
  console.log('--- 导入耗材 ---');
  const catMap = await getCategoryMap(token);
  if (Object.keys(catMap).length === 0) {
    throw new Error('supply_categories 表为空，请先运行 schema.sql 的 seed 数据');
  }
  // 可归还 = 非一次性耗材 + 玻璃器皿
  const RETURNABLE_CATS = new Set(['非一次性耗材', '玻璃器皿']);
  const supplyRows = [];
  for (const [catName, items] of Object.entries(suppliesByCategory)) {
    const categoryId = catMap[catName];
    if (!categoryId) {
      console.warn(`  ⚠️  未找到分类 "${catName}"，跳过 ${items.length} 条`);
      continue;
    }
    for (const item of items) {
      supplyRows.push({
        ...item,
        category_id: categoryId,
        is_returnable: RETURNABLE_CATS.has(catName),
      });
    }
  }
  await insertBatch(token, 'supplies', supplyRows);
  console.log(`  ✅ 导入 ${supplyRows.length} 条耗材\n`);

  console.log('--- 导入药品 ---');
  await insertBatch(token, 'chemicals', chemicals, 20);
  console.log(`  ✅ 导入 ${chemicals.length} 条药品\n`);

  console.log('=== 数据刷新完成 ===');
}

main().catch((err) => {
  console.error('\n❌ 失败:', err.message);
  process.exit(1);
});
