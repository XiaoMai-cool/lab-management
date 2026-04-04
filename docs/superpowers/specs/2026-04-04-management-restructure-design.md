# 管理功能重构设计

## 背景

当前手机端管理面板将所有管理入口平铺展示（最多9个），缺乏逻辑分组，用户难以快速找到目标功能。同时，采购审批和报销是两个独立模块，学生需要分别提交，无法看到一条采购从申请到报销的完整流程。

## 改动范围

两个独立但相关的改动：

1. **管理面板分组** — 纯前端改动
2. **采购流程合并** — 前后端改动

---

## 一、管理面板分组

### 现状

`Layout.tsx` 中的 `getManageItems()` 返回一个扁平列表，手机端以3列 grid 平铺展示，所有入口视觉上无区分。

### 目标

按职责将管理功能分组，分组标题 + 子功能直接平铺，打开面板即可一览全部内容，零额外点击。每个分组用不同颜色区分。用户只看到自己有权限的分组。

### 分组结构

| 分组 | 颜色 | 包含功能 | 可见角色 |
|-----|------|---------|---------|
| 采购审批（独立入口） | 绿色 | 审批学生采购申请 | 教师（isTeacher） |
| 报销管理 | 黄色 | 报销审批、报销统计 | 报销审批人（isReimbursementApprover）、耗材专人（isSuppliesManager）、药品专人（isChemicalsManager）。注：耗材/药品专人在此分组中只看到「报销统计」，看不到「报销审批」 |
| 耗材管理 | 蓝色 | 申领审批、库存管理、借用管理 | 耗材专人（isSuppliesManager） |
| 药品管理 | 紫色 | 药品库存、补货管理 | 药品专人（isChemicalsManager） |
| 系统管理 | 灰色 | 公告管理、人员管理、数据导出 | 管理员（isAdmin） |

### 实现方式

修改 `Layout.tsx`：

- 将 `getManageItems()` 改为返回分组结构（`ManageGroup[]`），每个分组包含 `label`、`color`、`items`
- 采购审批不归入任何分组，作为独立入口渲染在分组列表上方
- 手机端管理面板：遍历分组，每个分组渲染标题 + 3列 grid 子功能
- 桌面端侧边栏：同样按分组渲染，分组标题作为小标题分隔

### 数据结构

```typescript
interface ManageGroup {
  label: string;
  colorScheme: 'green' | 'yellow' | 'blue' | 'purple' | 'gray';
  items: NavItem[];
}

// 采购审批独立于分组之外
interface ManageConfig {
  standalone: NavItem[];  // 采购审批
  groups: ManageGroup[];  // 报销、耗材、药品、系统
}
```

---

## 二、采购流程合并

### 现状

- 学生在「采购审批」模块提交采购申请，教师审批
- 审批通过后，学生在「报销」模块重新提交报销申请，报销审批人审批
- 两个模块独立，数据通过 `purchase_approval_id` 弱关联
- 报销通过后，无自动流转到入库登记环节

### 目标

将采购审批和报销合并为一条记录，学生只需提交一次，后续所有环节在同一条记录上流转。

### 流程设计

#### 学生视角

一条采购记录经历两个阶段：

```
待审批 → 已批准（去买东西）→ 待报销（上传发票）→ 已报销
```

- 学生提交采购申请（标题、金额、类别、描述、附件）
- 教师审批通过后，记录进入「已批准」状态
- 学生采购完成后，在同一条记录上补充报销信息（发票、实际金额等）
- 报销审批人审批报销
- 学生全程只看到「审批」和「报销」两个阶段，不涉及入库

#### 教师（小老师）视角

- 审批学生的采购申请（待审批 → 已批准/已驳回）
- 审批后记录**持续可见**，能看到后续报销状态（未报销/已报销）
- 可查看自己名下所有学生的采购记录历史，方便溯源
- 学生之间数据隔离（学生只能看到自己的记录），但小老师能看到分配给自己的所有学生记录

#### 老师自行采购

- 老师（教师角色）提交采购申请时，**自动跳过审批环节**，记录直接进入「已批准」状态
- 报销流程正常走李健楠审批，与学生一致

#### 管理员视角

审批通过后，报销和入库是两个独立环节，不强制先后顺序：

- **报销审批人（李健楠）**：看到待报销的记录，审批时可看到该记录的入库状态（已登记/未登记）
- **耗材专人（王子寒）/ 药品专人（宋艳芳）**：看到需要入库的记录（按类别自动路由：药品→宋艳芳，非药品→王子寒），登记时可看到该记录的报销状态（已报销/未报销）

状态互通只显示轻量标签，不展示对方环节的详细信息。

### 数据模型变更

将 `purchase_approvals` 和 `reimbursements` 表合并为统一的 `purchases` 表（或在现有表上扩展），包含：

```
purchases:
  id
  applicant_id        -- 申请人
  title               -- 采购标题
  category            -- 类别（个人药品、设备配件、办公打印等）
  estimated_amount    -- 预估金额
  description         -- 描述
  attachments         -- 申请附件

  # 审批阶段
  approver_id         -- 审批教师（老师自行采购时为自己的 ID）
  approval_status     -- pending / approved / rejected
  approval_note       -- 审批备注
  approved_at         -- 审批时间
  auto_approved       -- boolean, 老师自行采购时为 true

  # 报销阶段
  actual_amount       -- 实际金额
  receipt_attachments -- 发票/收据附件
  reimbursement_status -- null(未提交) / pending / approved / rejected
  reimbursement_reviewer_id -- 报销审批人
  reimbursement_note  -- 报销备注
  reimbursed_at       -- 报销通过时间

  # 入库阶段（学生不可见）
  registration_status -- null(未登记) / registered
  registered_by       -- 登记人
  registered_at       -- 登记时间

  created_at
  updated_at
```

### 自动路由规则

入库登记根据 `category` 自动分配：
- `category = '个人药品'` → 药品专人（宋艳芳）
- 其他类别 → 耗材专人（王子寒）

### 报销统计页面增强

报销统计只在「报销管理」分组中出现一次，页面内通过 Tab 切换类别：

**Tab 设计**：`全部` / `非药品` / `药品`

**Tab 可见权限**：
- 报销审批人 / 超管：全部三个 Tab
- 耗材专人：全部三个 Tab
- 药品专人：全部三个 Tab

注：所有有权限的角色看到的数据范围相同（全量），Tab 仅用于方便筛选查看，不做权限隔离。

**筛选功能增强**：
- 按姓名筛选
- 按时间范围筛选
- 按金额筛选（支持 500 元以上等阈值筛选）
- 按类别筛选（已有）

### 页面变更

| 当前页面 | 变更 |
|---------|------|
| `PurchaseApprovalForm.tsx` | 改为统一的采购申请表单。老师提交时自动跳过审批 |
| `PurchaseApprovalList.tsx` | 改为学生/老师的采购记录列表，显示完整流程线（审批→报销） |
| `PurchaseApprovalReview.tsx` | 保留教师审批功能，增加已审批记录的后续状态展示（报销状态） |
| `ReimbursementForm.tsx` | 改为在已批准的采购记录上补充报销信息 |
| `ReimbursementList.tsx` | 合并到采购记录列表 |
| `ReimbursementReview.tsx` | 保留，报销审批人审批报销 |
| `ReimbursementStats.tsx` | 增加 Tab 切换（全部/非药品/药品）+ 增强筛选（姓名、时间、金额） |
| 新增：入库登记页面 | 管理员查看待登记物资，标记已登记 |

### 底部导航调整

当前底部导航「报销」Tab 改为「采购」，路由指向统一的采购记录列表。学生在这里完成从申请到报销的全部操作。

---

## 三、安全加固

### 现状

- 报销记录：后端 RLS 严格隔离 ✅
- 采购审批、物资申领：RLS 策略为 `SELECT ... USING (true)`，所有登录用户可读全部记录，仅靠前端过滤 ⚠️

### 改进

为 `purchases` 表（合并后）设置严格的 RLS 策略：

```sql
CREATE POLICY "purchases_select" ON purchases
  FOR SELECT TO authenticated USING (
    applicant_id = auth.uid()          -- 申请人看自己的
    OR approver_id = auth.uid()        -- 审批教师看分配给自己的
    OR manages_module('reimbursements') -- 报销审批人
    OR manages_module('supplies')       -- 耗材专人（入库）
    OR manages_module('chemicals')      -- 药品专人（入库）
    OR is_admin_or_above()             -- 管理员
  );
```

同时补齐 `supply_reservations` 表的 RLS 策略。

---

## 不在范围内

- 采购记录与耗材/药品库存系统的深度集成（如入库时自动创建库存条目）
- 通知系统（推送、站内消息等）
- 桌面端的大幅 UI 重构（仅跟随分组逻辑调整侧边栏）
