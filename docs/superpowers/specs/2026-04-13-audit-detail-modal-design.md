# 操作日志详情弹窗 + 附件图片预览 — 设计文档

> 日期: 2026-04-13

## 背景

当前操作日志只显示操作摘要，无法查看完整记录详情、附件和操作流转历史。审批详情弹窗中的图片附件也需要在弹窗内直接预览。

## 方案

1. 操作日志条目可点击，弹出详情 Modal（记录详情 + 附件预览 + 操作时间线）
2. 抽取统一的 FilePreview 组件，所有附件展示统一用它
3. 审批详情弹窗也改用 FilePreview，图片在弹窗内预览

---

## 1. FilePreview 组件

**新建 `src/components/FilePreview.tsx`**

统一的附件预览组件，接收文件列表，根据文件类型决定展示方式。

### Props

```tsx
interface FilePreviewProps {
  files: { name: string; url: string; type?: string; size?: number }[];
  title?: string; // 如 "采购附件"、"报销凭证"
}
```

### 展示逻辑

- **图片**（url 以 .jpg/.jpeg/.png/.gif/.webp 结尾，或 type 以 image/ 开头）→ 显示 `<img>` 缩略图（max-h-48），点击放大为全屏 overlay
- **非图片**（pdf/doc/xlsx 等）→ 显示文件名 + 文件图标 + "打开"链接（新标签页）

### 图片放大

点击缩略图 → 全屏半透明遮罩 + 居中大图 + 点击遮罩关闭

---

## 2. AuditDetailModal 组件

**新建 `src/components/AuditDetailModal.tsx`**

### Props

```tsx
interface AuditDetailModalProps {
  open: boolean;
  onClose: () => void;
  targetTable: string;
  targetId: string;
}
```

### 弹窗内容分两部分

#### 上半部分：记录详情

根据 `targetTable` 查询对应表的完整记录：

| targetTable | 查询 | 显示字段 |
|------------|------|---------|
| purchases | purchases + profiles(applicant, approver) | 标题、类别、采购类型、预估/实际金额、描述、审批状态、报销状态、附件(attachments)、报销凭证(receipt_attachments) |
| chemicals | chemicals | 名称、编号、CAS号、规格、纯度、厂家、库存、单位、存放位置、分类 |
| supply_reservations | supply_reservations + supplies + profiles | 物品、申请人、数量、用途、状态、审批备注 |
| supply_borrowings | supply_borrowings + supplies + profiles | 物品、借用人、数量、用途、状态、借出/归还时间 |
| profiles | profiles | 用户名、邮箱、角色、管理模块 |

附件用 FilePreview 组件渲染。

#### 下半部分：操作时间线

查询 `audit_log` 中 `target_table = targetTable AND target_id = targetId` 的所有记录，按 `created_at` 正序排列。

每条时间线节点显示：
- 时间（YYYY-MM-DD HH:mm）
- 操作人
- 操作类型（彩色标签）
- 详情摘要（备注、金额变化等）

使用竖线连接的时间线样式。

---

## 3. AuditLogTab 改造

**修改 `src/pages/admin/AuditLogTab.tsx`**

- 日志条目从 `<div>` 改为可点击（cursor-pointer + hover 效果）
- 点击后打开 AuditDetailModal，传入 `targetTable` 和 `targetId`
- 没有 `target_id` 的日志不可点击

---

## 4. 审批详情弹窗附件改造

**修改 `src/pages/purchase-approvals/PurchaseApprovalReview.tsx`**
**修改 `src/pages/reimbursements/ReimbursementReview.tsx`**

将现有的附件文件列表（`<a>` 链接 + ExternalLink 图标）替换为 FilePreview 组件：
- 图片在弹窗内直接预览
- 非图片保持新标签页打开

---

## 5. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/FilePreview.tsx` | **新建** — 统一附件预览组件 |
| `src/components/AuditDetailModal.tsx` | **新建** — 操作日志详情弹窗 |
| `src/pages/admin/AuditLogTab.tsx` | 日志条目可点击，打开详情弹窗 |
| `src/pages/purchase-approvals/PurchaseApprovalReview.tsx` | 附件改用 FilePreview |
| `src/pages/reimbursements/ReimbursementReview.tsx` | 附件改用 FilePreview |
