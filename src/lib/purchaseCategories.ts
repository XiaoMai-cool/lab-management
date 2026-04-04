import type { PurchaseCategory } from './types';

interface CategoryConfig {
  label: PurchaseCategory;
  description: string;
  defaultSkipRegistration: boolean;
}

export const PURCHASE_CATEGORIES: CategoryConfig[] = [
  { label: '试剂药品', description: '化学/生物试剂、标准品、培养基', defaultSkipRegistration: false },
  { label: '实验耗材', description: '一次性耗材、玻璃器皿、样品瓶等', defaultSkipRegistration: false },
  { label: '设备配件', description: '仪器维修、零配件、升级改造', defaultSkipRegistration: false },
  { label: '服装劳保', description: '实验服、防护用品', defaultSkipRegistration: false },
  { label: '测试加工', description: '外送检测、样品加工', defaultSkipRegistration: true },
  { label: '会议培训', description: '会议费、培训费', defaultSkipRegistration: true },
  { label: '出版知产', description: '版面费、专利费、文献数据库', defaultSkipRegistration: true },
  { label: '办公用品', description: '打印、文具、办公耗材', defaultSkipRegistration: true },
  { label: '差旅交通', description: '出差、交通费', defaultSkipRegistration: true },
  { label: '邮寄物流', description: '快递、运输费', defaultSkipRegistration: true },
  { label: '其他', description: '以上未覆盖的支出', defaultSkipRegistration: true },
];

export function getDefaultSkipRegistration(category: PurchaseCategory): boolean {
  const config = PURCHASE_CATEGORIES.find(c => c.label === category);
  return config?.defaultSkipRegistration ?? true;
}
