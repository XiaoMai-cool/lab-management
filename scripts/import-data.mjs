/**
 * 数据导入脚本 - 将现有 Excel 库存数据和文档资料导入 Supabase
 */

const SUPABASE_URL = 'https://lzvhbudvzzigwqysyzha.supabase.co';
const SUPABASE_KEY = 'sb_publishable_v_0WFndHPZcW44ZE07rsSw_aH0TGha6';

// First get admin token
async function getAdminToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'fengyujie@szu.edu.cn',
      password: 'Lab2026Admin!',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function supabaseInsert(token, table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ERROR inserting into ${table}:`, err);
    return false;
  }
  return true;
}

async function supabaseUpsert(token, table, rows, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ERROR upserting into ${table}:`, err);
    return false;
  }
  return true;
}

async function getCategories(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/supply_categories?select=id,name`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
    },
  });
  return await res.json();
}

async function main() {
  console.log('=== 开始导入数据 ===\n');

  const token = await getAdminToken();
  if (!token) {
    console.error('无法获取管理员 token');
    return;
  }
  console.log('✅ 管理员登录成功\n');

  // Get category IDs
  const categories = await getCategories(token);
  const catMap = {};
  categories.forEach(c => { catMap[c.name] = c.id; });
  console.log('✅ 耗材分类:', Object.keys(catMap).join(', '), '\n');

  // ==============================
  // 1. Import supplies (耗材库存)
  // ==============================
  console.log('--- 1. 导入耗材库存 ---');

  // 非一次性耗材 (Sheet 2)
  const nonDisposable = [
    { name: '参比电极', specification: '甘汞电极', stock: 4, unit: '个', min_stock: 1 },
    { name: '电子计数器', specification: '个', stock: 2, unit: '个', min_stock: 1 },
    { name: '订台', specification: '扫描电镜专用', stock: 10, unit: '个', min_stock: 2 },
    { name: '公牛插座', specification: '个', stock: 3, unit: '个', min_stock: 1 },
    { name: '漏斗', specification: '不同尺寸（7个塑料+2铁质）', stock: 9, unit: '个', min_stock: 2 },
    { name: '离心管架', specification: '10ml', stock: 14, unit: '个', min_stock: 3 },
    { name: '离心管架', specification: '20ml（木质）', stock: 3, unit: '个', min_stock: 1 },
    { name: '枪头盒', specification: '10uL', stock: 5, unit: '个', min_stock: 2 },
    { name: '枪头盒', specification: '100ul', stock: 4, unit: '个', min_stock: 2 },
    { name: '枪头盒', specification: '200μL', stock: 5, unit: '个', min_stock: 2 },
    { name: '枪头盒', specification: '1ml', stock: 13, unit: '个', min_stock: 3 },
    { name: '枪头盒', specification: '5ml', stock: 3, unit: '个', min_stock: 1 },
    { name: '塑料量杯', specification: '5L', stock: 4, unit: '个', min_stock: 1 },
  ].map(item => ({ ...item, category_id: catMap['非一次性耗材'] }));

  // 玻璃器皿 (Sheet 3)
  const glassware = [
    { name: '比色管', specification: '10ml（盒）', stock: 0, unit: '盒', min_stock: 1 },
    { name: '比色管', specification: '25ml（盒）', stock: 2, unit: '盒', min_stock: 1 },
    { name: '比色管', specification: '100ml（个）', stock: 12, unit: '个', min_stock: 2 },
    { name: '滴定管', specification: '25ml', stock: 2, unit: '个', min_stock: 1 },
    { name: '滴定管', specification: '50ml', stock: 1, unit: '个', min_stock: 1 },
    { name: '容量瓶', specification: '50mL', stock: 1, unit: '个', min_stock: 2 },
    { name: '容量瓶', specification: '100mL', stock: 2, unit: '个', min_stock: 2 },
    { name: '容量瓶', specification: '250ml', stock: 0, unit: '个', min_stock: 1 },
    { name: '容量瓶', specification: '500mL', stock: 3, unit: '个', min_stock: 2 },
    { name: '容量瓶', specification: '1000mL', stock: 0, unit: '个', min_stock: 1 },
    { name: '容量瓶', specification: '2000ml', stock: 1, unit: '个', min_stock: 1 },
    { name: '烧杯', specification: '50ml', stock: 1, unit: '个', min_stock: 2 },
    { name: '烧杯', specification: '100mL', stock: 0, unit: '个', min_stock: 2 },
    { name: '烧杯', specification: '250ml', stock: 2, unit: '个', min_stock: 1 },
    { name: '烧杯', specification: '500mL', stock: 0, unit: '个', min_stock: 2 },
    { name: '烧杯', specification: '5000mL', stock: 4, unit: '个', min_stock: 1 },
    { name: '蜀牛瓶', specification: '100mL', stock: 2, unit: '个', min_stock: 1 },
  ].map(item => ({ ...item, category_id: catMap['玻璃器皿'] }));

  // 一次性耗材 (Sheet 4)
  const disposable = [
    { name: '7号电池', specification: '个', stock: 4, unit: '个', min_stock: 2 },
    { name: 'COD试剂', specification: '高量程（小箱）', stock: 10, unit: '箱', min_stock: 3 },
    { name: 'COD试剂', specification: '低量程（小箱）', stock: 10, unit: '箱', min_stock: 3 },
    { name: 'COD试剂', specification: '25-1500量程', stock: 1, unit: '箱', min_stock: 1 },
    { name: '标签纸', specification: '袋', stock: 2, unit: '袋', min_stock: 1 },
    { name: '称量纸', specification: '60*60（包）', stock: 5, unit: '包', min_stock: 2 },
    { name: '称量纸', specification: '90*90（包）', stock: 2, unit: '包', min_stock: 1 },
    { name: '称量纸', specification: '150*150（包）', stock: 4, unit: '包', min_stock: 2 },
    { name: '定性滤纸', specification: '包（7cm）', stock: 3, unit: '包', min_stock: 1 },
    { name: '口罩', specification: '盒', stock: 20, unit: '盒', min_stock: 5 },
    { name: '离心管', specification: '1.5ml', stock: 1, unit: '袋', min_stock: 1 },
    { name: '离心管', specification: '5ml', stock: 7, unit: '袋', min_stock: 2 },
    { name: '离心管', specification: '10ml', stock: 6.5, unit: '袋', min_stock: 2 },
    { name: '离心管', specification: '圆底50mL', stock: 3, unit: '袋', min_stock: 1 },
    { name: '离心管', specification: '尖底50mL', stock: 5, unit: '袋', min_stock: 1 },
  ].map(item => ({ ...item, category_id: catMap['一次性耗材'] }));

  // 其他 (Sheet 5)
  const other = [
    { name: 'A/B胶', specification: '盒', stock: 1, unit: '盒', min_stock: 1 },
    { name: '便携式哈希多功能测试仪', specification: '个', stock: 1, unit: '个', min_stock: 0 },
    { name: '防毒面具', specification: '个', stock: 1, unit: '个', min_stock: 1 },
    { name: '缝纫机', specification: '台', stock: 1, unit: '台', min_stock: 0 },
    { name: '铝箔锡纸', specification: '卷', stock: 1, unit: '卷', min_stock: 1 },
    { name: '橡胶手套', specification: '双', stock: 1, unit: '双', min_stock: 1 },
  ].map(item => ({ ...item, category_id: catMap['其他'] }));

  const allSupplies = [...nonDisposable, ...glassware, ...disposable, ...other];

  let ok = await supabaseInsert(token, 'supplies', allSupplies);
  console.log(`  ${ok ? '✅' : '❌'} 导入 ${allSupplies.length} 条耗材记录\n`);

  // ==============================
  // 2. Import documents (文档资料)
  // ==============================
  console.log('--- 2. 导入文档资料 ---');

  // Get admin profile ID
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.fengyujie@szu.edu.cn&select=id`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
  });
  const [adminProfile] = await profileRes.json();
  const authorId = adminProfile.id;

  const documents = [
    {
      title: '危化品采购、登记、使用管理制度',
      category: '管理制度',
      sort_order: 1,
      author_id: authorId,
      content: `危化品采购、登记、使用管理制度

一、采购与登记
新危化品或即将用完的危化品找宋艳芳统一采购，并登记在共享腾讯文档中，禁止私自采购，会定期检查。

二、使用管理
1. 危化品使用需要在"药品使用记录本"上登记（放在危化品黄色药品柜旁边），例如：2026.01.05，宋艳芳使用20 mL硝酸，用于消解污泥。一旦发现未登记，警告一次，再次发现惩罚打扫实验室3天。
2. 使用完的危化品瓶子（带标签）需回收，集中放在危化品药品柜旁边的纸箱里。`,
    },
    {
      title: '课题组组会管理细则',
      category: '管理制度',
      sort_order: 2,
      author_id: authorId,
      content: `冯老师深圳大学团队课题组组会管理细则

为规范课题组组会组织与运行，提高科研交流效率，保障科研与管理工作有序开展，现就课题组组会相关事项制定如下细则，全体成员须严格遵守。

一、组会召开原则与频率
1. 原则上每半个月召开一次组会，具体时间由课题组统一安排。
2. 每次组会将提前通知全体成员，请各成员合理安排时间，按时参会。
3. 组会时间与地点应充分协调教师与学生的时间安排，并提前预约会议室，确保会议顺利进行。

二、参会要求与请假制度
1. 组会为课题组重要学术与事务会议，原则上要求全体成员参加。
2. 如因特殊原因无法正常出席组会，须提前向冯老师请假并说明原因，未经请假不得缺席。

三、组会内容与议程安排
组会一般包括以下三个部分，按议题制组织开展：

（一）实验室事务与管理讨论
主要讨论内容包括但不限于：
- 实验室管理与运行制度
- 仪器设备采购、使用及维护安排
- 课题组阶段性重点工作与重大事项调整
- 相关议题可提前提出，集中讨论，形成明确决议。

（二）科研进展汇报
组会成员需围绕本人研究方向进行科研进展汇报，内容应包括：
- 研究背景与目标
- 阶段性实验或研究进展
- 存在的问题与思考
- 下一步研究计划
- 日常组会汇报时间为 10–15 分钟；半年总结或年终总结汇报时间为 20–30 分钟。

（三）教师会议与指导交流
根据需要安排教师会议内容，对科研方向、关键问题和下一阶段工作进行指导与部署。

四、双周报告与会议记录要求
1. 课题组成员须按要求撰写双周科研进展报告，并严格按照统一模板，提交至邮箱：songyanfang@szu.edu.cn。
2. 组会过程中，应对重要讨论内容、意见建议及结论进行记录，作为后续科研工作和管理决策的重要依据。

五、汇报材料管理与资料归档
1. 每次组会开始前，汇报人须提前将汇报 PPT 拷贝至会议电脑，确保会议正常进行。
2. 组会结束后，所有汇报 PPT 须统一发送给宋老师进行备份存档，用于课题组资料管理和后续查阅。

六、组会汇报顺序
组会科研进展汇报顺序如下，可内部调整：彭鸿昌、邓岩昊、林弋杰、陈鸿林、麦宏博

七、附则
1. 本细则自发布之日起执行，适用于课题组全体成员。
2. 如在执行过程中需对相关条款进行调整，将由课题组讨论后统一修订。`,
    },
    {
      title: '实验室物资预约、领取及购买登记说明',
      category: '管理制度',
      sort_order: 3,
      author_id: authorId,
      content: `实验室物资预约、领取及购买登记说明

实验室物资分为个人物资和公共物资。公共物资由实验室统一采购和管理；个人物资由个人自行购买并使用，所有物资采购均需登记备案。

0. 公共物资分类

实验室公共物资基本分为以下三类：

（1）非一次性耗材（学期制领取）：
指可长期重复使用、但不随实验消耗的物品。此类耗材原则实行"一学期一次领取制"，由使用人领取后自行保管。如因损坏、遗失或确有实验需要需再次领取，须在预约时说明具体原因，经管理人员审核同意后方可再次发放。

（2）玻璃器皿：
包括烧杯、容量瓶、比色管等玻璃及其他可重复使用器皿。

（3）一次性耗材：
指在实验过程中消耗后不可再使用的物品，如枪头、手套、滤膜、离心管等。此类耗材可按实验需要预约领取，但须严格遵守本说明的预约领取流程。

1. 预约与领取流程说明

（1）预约提交：随时填写共享预约登记表。
（2）统一审核：每周一上午处理上一周预约。
（3）发放时间：每周一11:00后。
（4）发放地点：814实验室。
（5）领取周期：每周一次。
（6）周一9:00后提交的预约，顺延至下一周处理。
（7）原则上不接受周内临时领取。

2. 库存查询与更新说明

（1）共享表用于展示实时库存。
（2）每周一发放完成后，同步更新库存情况。
（3）预约前须自行查看库存。
（4）库存不足或用量较大时，需及时私信管理人员说明，采购到货后安排发放。
（5）管理人员将根据实际情况保障合理的实验耗材需求。

3. 学期制清点说明

（1）每学期初，对所有耗材进行统一清点。
（2）如相关物品后续不再使用，须在学期初完成清洗并归还。
（3）仍需继续使用的，可在确认后继续保留，无需重复领取。

4. 紧急情况说明

（1）确需临时使用时，须由责任老师向管理人员确认后方可领取。
（2）紧急领取后须补填预约记录。

5. 基本原则

（1）按需预约。
（2）如实填写。
（3）不重复领取。
（4）不私自取用。
（5）合理安排实验计划，尽量避免紧急领取。
（6）违规两次及以上暂停其一周领取资格。`,
    },
    {
      title: '实验室日常行为准则（试行）',
      category: '安全制度',
      sort_order: 4,
      author_id: authorId,
      content: `实验室日常行为准则（试行）

自2026年1月12日起正式执行。

一、实验室卫生
实行每月一轮换制度。

二、办公室值日
实行周值日制度，值日内容包括公共区域垃圾清运、环境清理及地面拖洗。
请各位务必将个人高挥发性、强异味物品及时带离，保障办公室空气质量。
值日时间为每周四，值日人员按以下顺序轮流负责：
彭鸿昌→邓岩昊→林弋杰→陈鸿琳→麦宏博

后续将不定时开展抽检工作。

三、废弃物处理
相关废弃物处理容器已购置到位，请大家严格按照实验室行为准则要求，分类投放各类实验废弃物。`,
    },
  ];

  ok = await supabaseInsert(token, 'documents', documents);
  console.log(`  ${ok ? '✅' : '❌'} 导入 ${documents.length} 篇文档资料\n`);

  // ==============================
  // 3. Import announcements (公告)
  // ==============================
  console.log('--- 3. 导入公告 ---');

  const announcements = [
    {
      title: '实验室日常管理相关事项通知',
      content: '实验室日常行为准则（试行）已落实，自1月12日起正式执行。实验室卫生实行每月一轮换制度，办公室实行周值日制度（每周四）。值日人员按彭鸿昌→邓岩昊→林弋杰→陈鸿琳→麦宏博的顺序轮流负责。废弃物处理容器已购置到位，请严格按照行为准则分类投放。',
      priority: 'important',
      author_id: authorId,
      published: true,
    },
    {
      title: '实验室物资管理登记说明',
      content: '请大家仔细阅读实验室物资管理相关说明，按需按规预约领取耗材，避免浪费。公共物资每周一11:00后统一发放，请提前在系统中提交预约。原有表格已登记领取库存已同步，无需重复登记。',
      priority: 'normal',
      author_id: authorId,
      published: true,
    },
    {
      title: '实验室管理系统上线通知',
      content: '实验室管理系统已正式上线，请各位使用分配的账号登录。系统功能包括：耗材预约、药品管理、制度查看、值日查询、报销申请等。如有问题请联系管理员。',
      priority: 'urgent',
      author_id: authorId,
      published: true,
    },
  ];

  ok = await supabaseInsert(token, 'announcements', announcements);
  console.log(`  ${ok ? '✅' : '❌'} 导入 ${announcements.length} 条公告\n`);

  console.log('=== 数据导入完成 ===');
}

main().catch(console.error);
