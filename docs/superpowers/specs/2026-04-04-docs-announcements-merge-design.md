# 公告与文档资料合并设计

## 背景

公告和文档资料目前是两个独立模块，入口分散。用户需要在不同地方查看公告和文档。将两者合并到同一个页面，用 Tab 切换，统一管理和查看。

## 改动范围

1. 学生端：`/documents` 页面增加 Tab（公告 + 文档资料）
2. 管理端：`/admin/announcements` 页面增加 Tab（公告管理 + 文档管理）
3. Dashboard 公告栏「查看全部」链接修正

---

## 学生端

### 页面：`/documents`

顶部两个 Tab：

**Tab 1「公告」（默认）：**
- 公告列表，按时间倒序排列
- 每条显示：标题、优先级标签（紧急/重要）、日期、作者
- 点击跳转到公告详情页（`/announcements/:id`），显示完整内容+附件+返回按钮

**Tab 2「文档资料」：**
- 文档列表，按分类和排序展示
- 点击跳转到文档详情页（`/documents/:id`）

### URL 参数

`/documents?tab=announcements` — 直接打开公告 Tab
`/documents?tab=docs` — 直接打开文档 Tab
默认打开公告 Tab

---

## 管理端

### 页面：`/admin/announcements`

顶部两个 Tab：

**Tab 1「公告管理」：**
- 现有的公告增删改功能（保持不变）
- 标题、内容、优先级、附件、登录页展示

**Tab 2「文档管理」：**
- 将现有的文档编辑功能（`/documents/new`、`/documents/:id/edit`）整合到这里
- 文档列表 + 添加/编辑/删除操作
- 编辑字段：标题、分类、内容

---

## 管理面板与后台调整

- 管理面板系统管理分组：「公告管理」改名为「公告与文档管理」
- AdminDashboard：「公告管理」和「文档资料」两张卡片合并为一张「公告与文档管理」

---

## 导航调整

| 位置 | 当前 | 改为 |
|-----|------|------|
| Dashboard「查看全部」 | 跳到 `/documents` | 跳到 `/documents?tab=announcements` |
| Dashboard 快捷操作「文档资料」 | 跳到 `/documents` | 改名为「公告与文档」，保持跳 `/documents` |
| 个人中心「文档资料」 | 跳到 `/documents` | 改名为「公告与文档」，保持跳 `/documents` |

---

## 页面变更

| 页面 | 变更 |
|-----|------|
| `DocumentList.tsx` | 重写为 Tab 页面，Tab 1 显示公告列表（查询 announcements 表），Tab 2 显示文档列表（现有逻辑） |
| `AnnouncementManage.tsx` | 增加 Tab 2「文档管理」，整合文档的增删改功能。页面标题改为「公告与文档管理」 |
| `Dashboard.tsx` | 「查看全部」链接改为 `/documents?tab=announcements` |
| `DocumentEdit.tsx` | 保留，用于文档编辑页面（从管理端跳转） |
| `DocumentView.tsx` | 保留，用于文档详情查看 |
| 新增：`AnnouncementView.tsx` | 公告详情页（`/announcements/:id`），显示完整内容+附件+返回按钮 |
| `AnnouncementManage.tsx` | 公告编辑改为跳转独立页面（与文档编辑一致），不用 Modal |
| `AdminDashboard.tsx` | 「公告管理」+「文档资料」卡片合并为「公告与文档管理」 |
| `Layout.tsx` | 管理面板「公告管理」改名为「公告与文档管理」 |
| `Dashboard.tsx` | 快捷操作「文档资料」改名为「公告与文档」 |
| `ProfilePage.tsx` | 快捷入口「文档资料」改名为「公告与文档」 |

---

## 不在范围内

- 公告和文档的数据合并（仍为两张独立的表）
- 文档的附件功能（仅公告有附件）
- 文档分类的管理化（目前文档分类是手动填写）
