# 实验室管理系统功能架构文档

> 最后更新: 2026-04-12

## 1. 用户角色体系

### 角色定义

| 角色 | 权限等级 | 描述 | 核心权限 |
|------|--------|------|---------|
| **super_admin** | 5 | 超级管理员 | 全系统权限，可管理所有模块 |
| **admin** | 4 | 管理员 | 管理员权限（公告、文档、人员、数据导出等） |
| **manager** | 3 | 板块负责人 | 模块级权限，可管理特定模块 |
| **teacher** | 2 | 教师 | 可审批采购、创建需求，可借用物资 |
| **student** | 1 | 学生 | 基础用户权限，可申领物资、提交报销 |

### 管理模块权限

通过 `managed_modules` 字段为用户分配模块级权限：

| 模块 | 权限代码 | 功能描述 |
|------|--------|---------|
| 物资管理 | `supplies` | 申领审批、库存管理、物资追踪、入库登记 |
| 药品管理 | `chemicals` | 药品库存、补货管理、入库登记 |
| 报销管理 | `reimbursements` | 报销审批、报销统计 |
| 值日排班 | `duty` | 值日管理、排班配置 |

---

## 2. 功能模块

### 2.1 首页仪表板

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 首页 | `/` | Dashboard | 已认证 |

内容：快捷操作、待办事项、值日提醒、库存警告、最新公告

---

### 2.2 物资管理模块

**目录**: `src/pages/supplies/`

**流程**: 申领 → 审批 → 发放 → 归还

#### 用户端

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 物资列表 | `/supplies` | SupplyList | 已认证 |
| 申领物资 | `/supplies/reserve` | SupplyReserve | 已认证 |
| 我的申领 | `/supplies/my-reservations` | MyReservations | 已认证 |
| 申请归还 | `/supplies/my-returns` | SupplyReturn | 已认证 |

#### 管理端

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 申领审批 | `/supplies/review` | ReservationReview | supplies 模块 |
| 物资追踪 | `/supplies/borrowings` | BorrowingManage | supplies 模块 |
| 库存管理 | `/admin/supplies` | SupplyManage | supplies 模块 |

---

### 2.3 药品管理模块

**目录**: `src/pages/reagents/`

**流程**: 库存管理 → 补货警告 → 采购登记

#### 用户端

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 药品列表 | `/reagents` | ReagentList | 已认证 |
| 药品详情 | `/reagents/:id` | ReagentDetail | 已认证 |
| 采购申请 | `/reagents/purchase` | ReagentPurchaseRequest | 已认证 |

#### 管理端

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 新增/编辑药品 | `/reagents/new`, `/reagents/:id/edit` | ReagentForm | chemicals 模块 |
| 补货警告 | `/reagents/warnings` | ChemicalWarnings | chemicals 模块 |

---

### 2.4 采购审批模块

**目录**: `src/pages/purchase-approvals/`

**流程**: 申请 → 审批 → 采购登记 → 报销

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 新建/编辑采购 | `/purchase-approvals/new`, `/purchase-approvals/edit/:id` | PurchaseApprovalForm | 已认证 |
| 我的采购 | `/purchase-approvals` | PurchaseApprovalList | 已认证 |
| 采购审批 | `/purchase-approvals/review` | PurchaseApprovalReview | teacher 角色 |

**采购分类**: 试剂药品、实验耗材、设备配件、服装劳保、测试加工、会议培训、出版知产、办公用品、差旅交通、邮寄物流、其他

**动态表单字段**:
- 试剂药品：名称、CAS号、规格、浓度、纯度、厂家、数量、单位
- 耗材/设备/服装：名称、规格型号、数量、单位
- 其他分类：仅标题和描述

---

### 2.5 报销模块

**目录**: `src/pages/reimbursements/`

**流程**: 提交报销 → 审批 → 完成

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 报销申请 | `/reimbursements/new?purchase_id=xxx` | ReimbursementForm | 已认证 |
| 报销审批 | `/reimbursements/review` | ReimbursementReview | reimbursements 模块 |
| 报销统计 | `/reimbursements/stats` | ReimbursementStats | reimbursements/supplies/chemicals 模块 |

---

### 2.6 采购登记

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 入库登记 | `/purchases/registration` | RegistrationPage | supplies/chemicals 模块 |

---

### 2.7 文档与公告模块

**目录**: `src/pages/documents/`, `src/pages/admin/`

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 文档列表 | `/documents` | DocumentList | 已认证 |
| 文档详情 | `/documents/:id` | DocumentView | 已认证 |
| 编辑文档 | `/documents/new`, `/documents/:id/edit` | DocumentEdit | admin 角色 |
| 公告详情 | `/announcements/:id` | AnnouncementView | 已认证 |
| 公告管理 | `/admin/announcements` | AnnouncementManage | admin 角色 |

---

### 2.8 值日排班模块

**目录**: `src/pages/duty/`, `src/pages/admin/`

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 值日查询 | `/duty` | DutyRoster | 已认证 |
| 值日管理 | `/admin/duty-manage` | DutyManage | duty 模块 |

**值日类型**: 实验室值日（周轮转）、办公室值日（月轮转）

---

### 2.9 个人中心

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 个人中心 | `/profile` | ProfilePage | 已认证 |

---

### 2.10 管理后台

**目录**: `src/pages/admin/`

| 页面 | 路由 | 组件 | 权限 |
|------|------|------|------|
| 后台首页 | `/admin` | AdminDashboard | admin 角色 |
| 人员管理 | `/admin/members` | MemberManage | members 模块 |
| 数据导出 | `/admin/export` | DataExport | admin 角色 |

---

## 3. 业务流程

### 3.1 物资申领流程

```
用户申领 [SupplyReserve]
  → 提交申领单 (pending)
  → 管理员审批 [ReservationReview]
    ├─ 批准 (approved) → 用户领取 → 归还 [SupplyReturn]
    └─ 驳回 (rejected)
```

### 3.2 采购与报销流程

```
用户提交采购申请 [PurchaseApprovalForm]
  → 教师审批 [PurchaseApprovalReview]
    ├─ 批准 → 用户执行采购
    │   ├─ 入库登记 [RegistrationPage] (可选)
    │   └─ 提交报销 [ReimbursementForm]
    │       → 报销审批 [ReimbursementReview]
    │         ├─ 批准 (完成)
    │         └─ 驳回 (可重新提交)
    └─ 驳回
    
自动报销: 采购时同时填了金额+附件 → 审批通过后自动进入报销流程
```

### 3.3 药品补货流程

```
用户报告库存不足 [ChemicalWarnings]
  → pending → ordered → arrived
```

### 3.4 值日轮转

```
管理员配置 [DutyManage]: 基准日期 + 轮转周期 + 参与人员
  → 自动计算轮转
  → 支持临时调整 (override)
```

---

## 4. 共享组件

**目录**: `src/components/`

### UI 组件

| 组件 | 用途 |
|------|------|
| Card | 内容卡片容器 |
| Modal | 模态对话框 |
| PageHeader | 页面标题 |
| SubNav | 二级导航 |
| StatusBadge | 状态标记 |
| EmptyState | 空状态提示 |
| LoadingSpinner | 加载动画 |

### 功能组件

| 组件 | 用途 |
|------|------|
| FileUploader | 文件上传（进度条、失败重试） |
| FileAttachmentList | 附件列表展示 |
| RichTextEditor | 富文本编辑器（Tiptap） |
| RichTextRenderer | 富文本渲染 |
| ProtectedRoute | 路由权限保护 |
| Layout | 主布局（侧边栏 + 导航） |

---

## 5. 技术栈

### 前端框架
- React 19 + TypeScript
- React Router DOM 6
- Vite (构建)
- Tailwind CSS 4

### 功能库
- @supabase/supabase-js — 数据库/认证/存储
- @tiptap/react — 富文本编辑
- dayjs — 日期处理
- xlsx — Excel 导出
- lucide-react — 图标

### 后端服务
- **Supabase** — 数据库 (PostgreSQL) + 认证 + 文件存储
- **Cloudflare Pages** — 静态部署

### Supabase Storage

| Bucket | 用途 | 访问 |
|--------|------|------|
| attachments | 所有附件 | 公开读取，认证用户上传 |

---

## 6. 工具函数

| 文件 | 用途 |
|------|------|
| `lib/supabase.ts` | Supabase 客户端 |
| `lib/auditLog.ts` | 操作日志（静默失败） |
| `lib/dutyCalculation.ts` | 值日轮转算法 |
| `lib/purchaseCategories.ts` | 采购分类配置 |
| `lib/storage.ts` | 文件存储操作 |
| `lib/sanitize.ts` | HTML 清理 |
| `lib/exportExcel.ts` | Excel 导出 |
| `contexts/AuthContext.tsx` | 全局认证与权限 |
| `contexts/ModeContext.tsx` | 使用/管理模式切换 |

---

## 7. 导航结构

### 底部导航（所有用户）

首页 `/` · 物资 `/supplies` · 药品 `/reagents` · 采购 `/purchase-approvals` · 我的 `/profile`

### 侧边栏管理功能（按权限动态显示）

- **审批** — 采购审批 (teacher)
- **报销管理** — 报销审批、报销统计 (reimbursements 模块)
- **耗材管理** — 申领审批、库存管理、物资追踪、入库登记 (supplies 模块)
- **药品管理** — 药品库存、补货管理、入库登记 (chemicals 模块)
- **系统管理** — 公告文档、人员管理、数据导出 (admin 角色)
