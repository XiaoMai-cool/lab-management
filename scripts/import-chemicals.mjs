/**
 * 导入药品汇总表到 chemicals 表
 */
const SUPABASE_URL = 'https://lzvhbudvzzigwqysyzha.supabase.co';
const SUPABASE_KEY = 'sb_publishable_v_0WFndHPZcW44ZE07rsSw_aH0TGha6';

async function getAdminToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fengyujie@szu.edu.cn', password: 'Lab2026Admin!' }),
  });
  return (await res.json()).access_token;
}

async function insertChemicals(token, rows) {
  // Insert in batches of 20
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chemicals`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(`  Batch ${i} error:`, await res.text());
    }
  }
}

// GHS labels for common hazardous chemicals
const GHS_MAP = {
  '硝酸': ['GHS03', 'GHS05'],      // 氧化性、腐蚀性
  '硫酸': ['GHS05'],                // 腐蚀性
  '盐酸': ['GHS05', 'GHS07'],      // 腐蚀性、刺激性
  '甲酸': ['GHS02', 'GHS05', 'GHS06'], // 易燃、腐蚀、毒
  '苯酚': ['GHS05', 'GHS06', 'GHS08'], // 腐蚀、毒、健康
  '丙酮': ['GHS02', 'GHS07'],      // 易燃、刺激
  '乙醇': ['GHS02'],               // 易燃
  '戊二醛': ['GHS05', 'GHS06', 'GHS09'], // 腐蚀、毒、环境
  '30%过氧化氢': ['GHS03', 'GHS05', 'GHS07'], // 氧化、腐蚀、刺激
  '磷酸': ['GHS05'],               // 腐蚀
  '氨水': ['GHS05', 'GHS07', 'GHS09'], // 腐蚀、刺激、环境
  '高锰酸钾': ['GHS03', 'GHS05', 'GHS07', 'GHS09'], // 氧化、腐蚀、刺激、环境
  '重铬酸钾标准滴定溶液': ['GHS03', 'GHS05', 'GHS06', 'GHS08', 'GHS09'],
  '异丙醇': ['GHS02', 'GHS07'],    // 易燃、刺激
  'N,N-二甲基甲酰胺': ['GHS02', 'GHS07', 'GHS08'], // 易燃、刺激、健康
  '三乙胺': ['GHS02', 'GHS05', 'GHS07'], // 易燃、腐蚀、刺激
  '硫氰酸钾': ['GHS07'],           // 有害
  '亚硝酸钠': ['GHS03', 'GHS06', 'GHS09'], // 氧化、毒、环境
  '氯化钡': ['GHS06'],             // 毒
  '氯霉素': ['GHS08'],             // 健康危害
  '乙炔黑': ['GHS02'],             // 易燃
};

async function main() {
  console.log('=== 导入药品汇总表 ===\n');
  const token = await getAdminToken();
  console.log('✅ 登录成功\n');

  const chemicals = [];

  // 常规药品 - A系列
  const regularA = [
    '乙酸胺','尿素','无水乙酸钠','碳酸氢钠','无水氯化钙','蔗糖',
    '四水合酒石酸钾钠','二水合磷酸二氢钠','无水氯化镁','二氧化硅',
    '磷酸氢二钠','无水硫酸钠','硫酸铁铵','乙酸锌','氯化钠',
    '七水合硫酸亚铁','膨润土','木质素磺酸钠','高岭土','磷酸二氢钾',
    '乙二胺四乙酸二钠','丁酸钠','丙酸钠','无水四硼酸钠','抗坏血酸',
    '海藻酸钠','无水葡萄糖','聚赖氨酸 盐酸盐','石墨粉','硫代硫酸钠',
    '六水合氯化镁','明胶','二水合氯化钙','十水合焦磷酸钠',
    'Tris-HCL 缓冲液','磷酸镁'
  ];
  const regularAQty = [1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1];
  regularA.forEach((name, i) => {
    chemicals.push({
      name: name.trim(),
      batch_number: `A${i+1}`,
      specification: '',
      stock: regularAQty[i] || 1,
      unit: '瓶',
      category: '普通试剂',
      location: 'A区',
      ghs_labels: GHS_MAP[name.trim()] || [],
    });
  });

  // 常规药品 - B系列
  const regularB = [
    '聚丙烯酰胺','鱼肠液','液体PVA','硫酸亚铁标准溶液','聚二烯二甲基氯化铵溶液',
    '36%乙酸溶液','无水三氯化铁','氯化钾','硫','氯化铵',
    '六水合三氯化铁','六水合三氯化铁铵','半水合酒石酸锑钾','氨基磺酸','亚硝酸钠',
    '十二水合硫酸氢二钠','乙酸（冰醋酸）','六氰合铁酸钾','过二硫酸钾','铬酸钾',
    '四水合钼酸铵','壳聚糖','磺胺','氯化钡','1,10-菲啰啉',
    '硼酸','氯化羟氨','二硫化铁','二甲基对苯二胺盐酸盐','氯霉素',
    '甲基红','盐酸萘乙二胺','百里香酚酞','磺胺甲恶唑','溴甲酚绿',
    '纤维素','炭黑','氢氧化钠','硫酸钾','乙酸戊异酯',
    '硫酸铝 九水合物','磷标准样品','钾标准样品','二水氯化铜','溴化钾','邻菲罗啉'
  ];
  const regularBQty = [1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1];
  regularB.forEach((name, i) => {
    chemicals.push({
      name: name.trim(),
      batch_number: `B${i+1}`,
      specification: '',
      stock: regularBQty[i] || 1,
      unit: '瓶',
      category: '普通试剂',
      location: 'B区',
      ghs_labels: GHS_MAP[name.trim()] || [],
    });
  });

  // 上架药品
  const shelfItems = [
    '高纯铁粉','高纯碳粉','耐盐菌','九邦发酵腐熟剂','农保有机肥发酵剂',
    '粗纤维降解专用菌','有机肥发酵菌剂','强兴堆肥发酵剂','九邦鱼蛋白发酵菌种','椰壳炭'
  ];
  shelfItems.forEach((name, i) => {
    chemicals.push({
      name: name.trim(),
      batch_number: `上-${i+1}`,
      specification: '',
      stock: 1,
      unit: '瓶',
      category: '生物试剂',
      location: '上架',
      ghs_labels: [],
    });
  });

  // 冷藏药品
  const coldItems = [
    { name: '土霉素（OTC）', code: 'D1', qty: 1 },
    { name: '氟苯尼考', code: 'D2', qty: 1 },
  ];
  coldItems.forEach(item => {
    chemicals.push({
      name: item.name,
      batch_number: item.code,
      specification: '',
      stock: item.qty,
      unit: '瓶',
      category: '生物试剂',
      location: '冷藏',
      ghs_labels: [],
    });
  });

  // 危化品
  const hazardous = [
    { name: '硝酸', code: 'C1', qty: 1 },
    { name: '硫酸', code: 'C2', qty: 4 },
    { name: '盐酸', code: 'C3', qty: 2 },
    { name: '甲酸', code: 'C4', qty: 1 },
    { name: '苯酚', code: 'C5', qty: 1 },
    { name: '丙酮', code: 'C6', qty: 1 },
    { name: '乙醇', code: 'C7', qty: 3 },
    { name: '戊二醛', code: 'C8', qty: 1 },
    { name: '重铬酸钾标准滴定溶液', code: 'C10', qty: 1 },
    { name: '30%过氧化氢', code: 'C11', qty: 1 },
    { name: '磷酸', code: 'C12', qty: 1 },
    { name: '氨水', code: 'C13', qty: 1 },
    { name: '高锰酸钾', code: 'C14', qty: 1 },
    { name: '硝酸钠', code: 'C16', qty: 1 },
    { name: '硫氰酸钾', code: 'C17', qty: 1 },
    { name: '硝酸钾', code: 'C18', qty: 2 },
    { name: '汞标准样品', code: 'C19', qty: 1 },
    { name: '多种金属标准样品', code: 'C20', qty: 1 },
    { name: '异丙醇', code: 'C24', qty: 2 },
    { name: '乙炔黑', code: 'C25', qty: 1 },
    { name: '硝酸钴，六水', code: 'C26', qty: 1 },
    { name: '苯基膦酸', code: 'C27', qty: 1 },
    { name: 'N,N-二甲基甲酰胺', code: 'C28', qty: 1 },
    { name: '三乙胺', code: 'C29', qty: 1 },
    { name: '2,5-噻吩二羧酸', code: 'C30', qty: 1 },
    { name: '硝酸铜，三水', code: 'C31', qty: 1 },
  ];
  hazardous.forEach(item => {
    chemicals.push({
      name: item.name.trim(),
      batch_number: item.code,
      specification: '',
      stock: item.qty,
      unit: '瓶',
      category: '危险化学品',
      location: '危化品柜',
      ghs_labels: GHS_MAP[item.name.trim()] || [],
    });
  });

  console.log(`总计 ${chemicals.length} 种药品`);
  console.log(`  常规药品 A区: ${regularA.length}`);
  console.log(`  常规药品 B区: ${regularB.length}`);
  console.log(`  上架药品: ${shelfItems.length}`);
  console.log(`  冷藏药品: ${coldItems.length}`);
  console.log(`  危化品: ${hazardous.length}`);

  await insertChemicals(token, chemicals);
  console.log('\n✅ 药品数据导入完成');
}

main().catch(console.error);
