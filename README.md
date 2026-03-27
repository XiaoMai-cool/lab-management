# 实验室管理系统

深圳大学 冯老师课题组 实验室管理系统

## 项目状态

| 阶段 | 状态 |
|------|------|
| 前端开发 | ✅ 已完成（33个页面组件） |
| 数据库设计 | ✅ 已完成（18张表） |
| 用户认证 | ✅ 已完成（邮箱登录，无需验证） |
| Supabase 部署 | ✅ 已完成 |
| Cloudflare Pages 部署 | ✅ 已完成 |
| 药品全生命周期管理 | ✅ 已完成 |
| 账号管理（管理员直接创建） | ✅ 已完成 |
| 功能测试 & Bug 修复 | 🔄 进行中 |
| 数据迁移（从 Excel） | ⏳ 待开始 |
| 为所有成员创建账号 | ⏳ 待开始 |

## 在线访问

- **正式地址**：https://lab-management-3w7.pages.dev
- **清除缓存**：https://lab-management-3w7.pages.dev/?reset
- **Supabase 项目**：`https://lzvhbudvzzigwqysyzha.supabase.co`
- **GitHub 仓库**：https://github.com/XiaoMai-cool/lab-management

## 测试账号

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 超级管理员 | `fengyujie@szu.edu.cn` | `Lab2026Admin!` | 冯玉杰 - 全部权限 |
| 学生 | `student@szu.edu.cn` | `Student2026!` | 测试学生 - 基本权限 |

> 正式上线前请修改所有默认密码。邮箱仅作为登录账号，不会发送邮件。

## 功能模块

### 基础管理

- **首页总览**：公告栏、快捷操作、库存预警、值日信息、个人待办
- **耗材库存管理**：四分类（非一次性耗材/玻璃器皿/一次性耗材/其他）、预约申请、审批、领取记录
- **制度文档中心**：在线查看/编辑所有规章制度
- **值日排班**：实验室月轮换 + 办公室周值日（每周四，彭鸿昌→邓岩昊→林弋杰→陈鸿琳→麦宏博）
- **仪器设备管理**：设备列表、负责人、状态跟踪、故障上报
- **组会管理**：日程安排、汇报顺序、Progress Report 提交
- **报销申请**：提交申请、审批流程、记录查询

### 药品/试剂全生命周期管理

- **药品信息卡片**：名称、CAS号、分子式、规格、浓度、纯度、厂家、供应商、存放位置、批次号、有效期、价格
- **GHS安全标签**：9种标准图标可视化（爆炸/易燃/氧化/气体/腐蚀/剧毒/有害/健康危害/环境）
- **药品申购流程**：学生提交申购 → 负责人审批 → 记录下单 → 确认到货自动入库
- **出入库管理**：采购入库、退还入库、领用出库、废弃出库、库存调整
- **供应商管理**：名称、联系人、电话、地区，便捷录入
- **CAS号智能填充**：输入CAS号自动匹配已有药品信息
- **学生个人试剂台账**：
  - 查看自己使用过的所有试剂（药品名、CAS号、厂家、规格、浓度、用量、用途）
  - 导出论文格式（按厂家分组："硝酸 (AR, 国药集团)"）
  - 导出Excel完整记录

### 管理后台（中文界面，不需要编程）

- **公告管理**：发布/编辑/删除公告，支持普通/重要/紧急优先级
- **人员管理**：直接创建账号（填邮箱+密码+姓名+角色）、重置密码、删除账号
- **权限分配与交接**：选择板块 → 选择新负责人 → 一键交接
- **耗材管理**：添加/编辑/删除耗材，批量管理库存
- **数据导出**：一键导出耗材库存/预约记录/危化品记录/报销记录为CSV

### 用户认证

- 邮箱+密码登录（邮箱仅作账号名，无需真实邮箱）
- 管理员直接创建账号，无需注册流程
- 5种角色：超级管理员/管理员/板块负责人/教师/学生
- 可授权其他人管理"人员管理"模块

## 角色权限

| 角色 | 说明 | 权限 |
|------|------|------|
| `super_admin` 超级管理员 | 冯玉杰 | 全部权限 |
| `admin` 管理员 | 李健楠（代管） | 全部权限 |
| `manager` 板块负责人 | 各负责老师/同学 | 管理自己负责的板块 |
| `teacher` 教师 | 其他老师 | 查看 + 基本操作 |
| `student` 学生 | 课题组学生 | 查看制度、提交预约/申购、填写记录、报销申请 |

### 板块负责人分工

| 负责人 | 板块 |
|--------|------|
| 王邵鸿 | 实验室日常管理（值日排班、仪器管理） |
| 宋艳芳 | 危化品/药品管理（采购、登记、使用） |
| 王子寒 | 物资耗材管理（预约审批） |

## 技术栈

- **前端**：React + TypeScript + TailwindCSS v4 + Vite
- **后端/数据库**：Supabase（PostgreSQL + Auth + RLS）
- **部署**：Cloudflare Pages（自动部署）

## 部署更新

```bash
# 修改代码后，构建并部署
npm run build
npx wrangler pages deploy dist --project-name lab-management --commit-dirty=true --commit-message="更新说明"

# 提交到 GitHub
git add -A && git commit -m "更新说明" && git push
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 环境变量

创建 `.env` 文件（已在 .gitignore 中，不会上传）：

```
VITE_SUPABASE_URL=https://lzvhbudvzzigwqysyzha.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon_key
```

## 数据库

数据库包含 18 张表：

| 表名 | 用途 |
|------|------|
| `profiles` | 用户信息（扩展 auth.users） |
| `announcements` | 公告 |
| `documents` | 制度文档 |
| `supply_categories` | 耗材分类（4类） |
| `supplies` | 耗材库存 |
| `supply_reservations` | 耗材预约 |
| `chemicals` | 药品/试剂（含GHS标签、厂家、浓度等） |
| `chemical_usage_logs` | 药品使用记录 |
| `chemical_purchases` | 药品采购（旧版） |
| `suppliers` | 供应商 |
| `reagent_stock_movements` | 药品出入库记录 |
| `reagent_purchase_requests` | 药品申购单 |
| `duty_roster` | 值日排班 |
| `equipment` | 仪器设备 |
| `meetings` | 组会 |
| `meeting_reports` | Progress Report |
| `reimbursements` | 报销申请 |
| `purchase_logs` | 物资购买登记 |

### 数据库自定义函数

| 函数 | 用途 |
|------|------|
| `create_lab_user()` | 管理员创建账号（含identity记录） |
| `reset_user_password()` | 管理员重置密码 |
| `delete_lab_user()` | 管理员删除账号 |
| `handle_new_user()` | 注册时自动创建profile |
| `is_admin_or_above()` | RLS权限检查 |
| `manages_module()` | RLS模块权限检查 |

## 项目结构

```
src/
├── components/          # 通用 UI 组件（8个）
│   ├── Layout.tsx       # 主布局（侧边栏 + 底部导航 + 用户菜单）
│   ├── ProtectedRoute.tsx
│   ├── Modal.tsx, Card.tsx, PageHeader.tsx, StatusBadge.tsx, ...
├── contexts/
│   └── AuthContext.tsx   # 用户认证（自动清除无效session）
├── lib/
│   ├── supabase.ts      # Supabase 客户端
│   └── types.ts         # TypeScript 类型定义
├── pages/
│   ├── Dashboard.tsx     # 首页总览
│   ├── admin/           # 管理后台（5个页面）
│   ├── auth/            # 登录页
│   ├── chemicals/       # 危化品管理（旧版，4个页面）
│   ├── reagents/        # 药品全生命周期管理（7个页面）
│   ├── documents/       # 制度文档（3个页面）
│   ├── duty/            # 值日排班 & 仪器设备（2个页面）
│   ├── meetings/        # 组会管理（2个页面）
│   ├── profile/         # 个人中心
│   ├── reimbursements/  # 报销管理（3个页面）
│   └── supplies/        # 耗材管理（4个页面）
└── App.tsx              # 路由配置
```

## 待办事项

- [x] 前端开发（33个页面）
- [x] 数据库设计（18张表 + RLS + 触发器）
- [x] Supabase 部署
- [x] Cloudflare Pages 部署
- [x] 用户认证（邮箱登录，管理员创建账号）
- [x] 药品全生命周期管理（申购→入库→领用→出库→台账导出）
- [ ] 功能全面测试（各角色登录测试、各流程走通）
- [ ] 将现有 Excel 库存数据导入数据库
- [ ] 为课题组 12 名成员批量创建账号
- [ ] 上线前修改默认密码
- [ ] 将现有制度文档内容录入系统
- [ ] 配置自定义域名（可选）
