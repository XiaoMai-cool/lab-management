# 实验室管理系统

深圳大学 冯老师课题组 实验室管理系统

## 项目状态

| 阶段 | 状态 |
|------|------|
| 前端开发 | ✅ 已完成 |
| 数据库设计 | ✅ 已完成 |
| 用户认证 | ✅ 已完成 |
| Supabase 部署 | ✅ 已完成 |
| Cloudflare Pages 部署 | ⏳ 待部署 |
| 功能测试 & Bug 修复 | 🔄 进行中 |
| 数据迁移（从 Excel） | ⏳ 待开始 |

## 在线访问

- **部署地址**：待 Cloudflare Pages 部署后更新
- **Supabase 项目**：`https://lzvhbudvzzigwqysyzha.supabase.co`

## 测试账号

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 超级管理员 | `fengyujie@szu.edu.cn` | `Lab2026Admin!` | 冯玉杰 - 全部权限 |
| 学生 | `student@szu.edu.cn` | `Student2026!` | 测试学生 - 基本权限 |

> ⚠️ **正式上线前请修改所有默认密码**

## 功能模块

### 已实现

- **首页总览**：公告栏、快捷操作、库存预警、值日信息
- **耗材库存管理**：四分类（非一次性耗材/玻璃器皿/一次性耗材/其他）、预约申请、审批、领取记录
- **危化品管理**：采购登记、使用记录（替代纸质登记本）、库存查看
- **制度文档中心**：在线查看/编辑所有规章制度
- **值日排班**：实验室月轮换 + 办公室周值日（每周四）
- **仪器设备管理**：设备列表、负责人、状态跟踪、故障上报
- **组会管理**：日程安排、汇报顺序、Progress Report 提交
- **报销申请**：提交申请、审批流程、记录查询
- **管理后台**：公告管理、人员管理、权限分配与交接、耗材管理、数据导出（CSV）
- **用户认证**：邮箱登录、角色权限（超级管理员/管理员/板块负责人/教师/学生）

## 角色权限

| 角色 | 说明 | 权限 |
|------|------|------|
| `super_admin` 超级管理员 | 冯玉杰 | 全部权限 |
| `admin` 管理员 | 李健楠（代管） | 全部权限 |
| `manager` 板块负责人 | 王邵鸿/宋艳芳/王子寒 | 管理自己负责的板块 |
| `teacher` 教师 | 其他老师 | 查看 + 基本操作 |
| `student` 学生 | 课题组学生 | 查看制度、提交预约、值日、报销申请 |

### 板块负责人分工

| 负责人 | 板块 |
|--------|------|
| 王邵鸿 | 实验室日常管理（值日排班、仪器管理） |
| 宋艳芳 | 危化品采购、登记、使用管理 |
| 王子寒 | 物资耗材管理（预约审批） |

## 技术栈

- **前端**：React + TypeScript + TailwindCSS v4 + Vite
- **后端/数据库**：Supabase（PostgreSQL + Auth + RLS）
- **部署**：Cloudflare Pages（待配置）

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
VITE_SUPABASE_ANON_KEY=你的anon key
```

## 数据库

数据库 Schema 位于 `supabase/schema.sql`，包含：
- 15 张表（用户、公告、文档、耗材、危化品、值日、仪器、组会、报销等）
- 行级安全策略（RLS）
- 自动触发器（自动更新时间戳、新用户自动创建 Profile）

### 数据库变更流程

1. 修改 `supabase/schema.sql`
2. 在 Supabase SQL Editor 中执行变更语句
3. 或通过 psql 连接执行：
```bash
psql "postgresql://postgres:密码@db.lzvhbudvzzigwqysyzha.supabase.co:5432/postgres" -f supabase/schema.sql
```

## 项目结构

```
src/
├── components/          # 通用 UI 组件
│   ├── Card.tsx
│   ├── EmptyState.tsx
│   ├── Layout.tsx       # 主布局（顶栏 + 底部导航/侧边栏）
│   ├── LoadingSpinner.tsx
│   ├── Modal.tsx
│   ├── PageHeader.tsx
│   ├── ProtectedRoute.tsx
│   └── StatusBadge.tsx
├── contexts/
│   └── AuthContext.tsx   # 用户认证上下文
├── lib/
│   ├── supabase.ts      # Supabase 客户端
│   └── types.ts         # TypeScript 类型定义
├── pages/
│   ├── Dashboard.tsx     # 首页总览
│   ├── admin/           # 管理后台
│   ├── auth/            # 登录页
│   ├── chemicals/       # 危化品管理
│   ├── documents/       # 制度文档
│   ├── duty/            # 值日排班 & 仪器设备
│   ├── meetings/        # 组会管理
│   ├── profile/         # 个人中心
│   ├── reimbursements/  # 报销管理
│   └── supplies/        # 耗材管理
└── App.tsx              # 路由配置
```

## 待办事项

- [ ] 部署到 Cloudflare Pages
- [ ] 修复白屏 Bug（首页加载问题）
- [ ] 将现有 Excel 库存数据导入数据库
- [ ] 为所有课题组成员创建账号
- [ ] 上线前修改默认密码
- [ ] 配置自定义域名（可选）
