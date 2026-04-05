# 富文本编辑器 + 文档附件 + PDF 导出

## 概述

为公告和文档引入 TipTap 富文本编辑器，替换现有的纯文本 `<textarea>`。同时为文档新增附件上传功能，并支持通过浏览器打印导出 PDF。

## 1. 共享富文本编辑器组件

### 组件设计

新增 `src/components/RichTextEditor.tsx`，公告编辑和文档编辑共用。

**Props 接口：**

```typescript
interface RichTextEditorProps {
  content: string;           // HTML 字符串
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;        // 默认 200px
}
```

### 工具栏功能（轻量版）

| 功能 | TipTap 扩展 |
|------|-------------|
| 加粗 | StarterKit (Bold) |
| 斜体 | StarterKit (Italic) |
| 标题 H2/H3 | StarterKit (Heading) |
| 无序列表 | StarterKit (BulletList) |
| 有序列表 | StarterKit (OrderedList) |
| 链接 | @tiptap/extension-link |
| 插入图片 | @tiptap/extension-image |

### 依赖包

```
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-link
@tiptap/extension-image
@tiptap/pm
```

### 图片上传

- 工具栏"插入图片"按钮触发文件选择
- 上传至 Supabase `attachments` bucket，路径：`editor/{timestamp}.{ext}`
- 上传完成后插入 `<img src="公开URL">` 到编辑器
- 图片嵌在正文中，与附件区的文件分开

### 存储格式

- 编辑器输出 HTML 字符串，存入现有 `content` text 字段
- 无需修改字段类型（text 存 HTML 完全兼容）

### 移动端适配

- 工具栏单行排列，横向可滚动（`overflow-x: auto`）
- 按钮尺寸不小于 36x36px（触控友好）

## 2. 现有内容兼容

### 渲染策略

检测 content 是否包含 HTML 标签：

- **含 HTML 标签** → 用 `dangerouslySetInnerHTML` 渲染，经白名单过滤
- **纯文本** → 用 `whitespace-pre-wrap` 原样渲染

```typescript
function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}
```

### 编辑兼容

- TipTap 打开纯文本时自动包裹为 `<p>` 标签
- 保存后 content 变为 HTML 格式
- 渐进式迁移，无需批量转换脚本

### HTML 安全

渲染时过滤标签白名单：`p, h2, h3, strong, em, ul, ol, li, a, img, br, hr`。

虽然内容只有管理员/老师能编辑（RLS 保证），仍做防御性过滤。

## 3. 文档附件系统

### 数据库变更

```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
```

附件结构复用公告的 `AnnouncementAttachment` 接口：

```typescript
interface FileAttachment {
  name: string;   // 原始文件名
  url: string;    // Supabase 公开 URL
  type: string;   // MIME type
  size: number;   // 字节数
}
```

重命名为通用的 `FileAttachment`，公告和文档共用。

### 文件上传

- 复用现有上传模式（与公告附件一致）
- 存储路径：`documents/{timestamp}.{ext}`
- 存储桶：现有的 `attachments` bucket
- 接受类型：`image/*, .pdf, .doc, .docx, .xls, .xlsx`
- 单文件大小限制：10MB（前端校验）

### 附件展示（查看页面）

- 所有文件显示为列表：文件图标 + 文件名 + 大小 + 下载按钮
- PDF / Word / Excel：点击直接下载
- 图片类文件（`image/*`）：额外显示"展示/收起"切换按钮
  - 默认收起，查看者自行决定是否预览
  - 点击"展示"后在文件项下方展开图片预览
  - 点击"收起"折叠回去

### 附件管理（编辑页面）

- 文件选择 + 上传进度
- 已上传附件可删除（从 JSONB 中移除，不删 Storage 文件）
- 与公告附件编辑交互一致

## 4. PDF 导出（仅文档）

### 实现方式

使用 `window.print()` + `@media print` CSS。

### 文档详情页变更

- 新增"导出 PDF"按钮（在页面操作区）
- 点击调用 `window.print()`

### 打印样式

```css
@media print {
  /* 隐藏所有 UI 元素 */
  nav, .bottom-nav, .page-header button, .sub-nav { display: none; }

  /* 只显示文档内容 */
  .document-content { max-width: 100%; margin: 0; }

  /* 附件列表简化为文件名列表 */
  .attachment-preview { display: none; }
}
```

打印输出内容：标题 + 分类 + 作者/日期 + 正文 + 附件文件名列表。

### 零依赖

不引入任何 PDF 生成库。后续如有"一键下载 PDF"需求，再评估 html2pdf.js。

## 5. 存储用量提示（仅超级管理员）

在管理面板中为超级管理员显示 Supabase Storage 已用空间。

### 实现方式

- 调用 `supabase.storage.from('attachments').list()` 遍历文件，累加 size
- 在管理面板首页或设置区域显示：`已用 xxx MB / 1 GB`
- 仅 `super_admin` 角色可见
- 接近上限（>80%）时显示黄色警告

### 注意

Supabase JS SDK 的 `list()` 不直接返回 bucket 总用量，需要遍历文件夹累加。如果文件数量多性能不好，可改为在每次上传时在数据库记录文件大小，用 SQL 聚合查询。初期文件少，遍历方式足够。

## 6. 影响范围

### 需修改的文件

| 文件 | 变更 |
|------|------|
| `src/components/RichTextEditor.tsx` | **新建** — 共享富文本编辑器组件 |
| `src/components/FileAttachmentList.tsx` | **新建** — 附件展示组件（图片可展开） |
| `src/components/FileUploader.tsx` | **新建** — 附件上传组件（从公告中抽取复用） |
| `src/pages/admin/AnnouncementManage.tsx` | 编辑区 textarea → RichTextEditor；附件上传改用 FileUploader |
| `src/pages/documents/DocumentEdit.tsx` | textarea → RichTextEditor；新增附件上传区 |
| `src/pages/documents/DocumentView.tsx` | HTML 渲染 + 附件展示 + 导出 PDF 按钮 + @media print |
| `src/pages/documents/AnnouncementView.tsx` | HTML 渲染（兼容纯文本） |
| `src/pages/documents/DocumentList.tsx` | 无变更（列表只显示标题） |
| `src/lib/types.ts` | 新增 FileAttachment 接口，Document 类型加 attachments 字段 |
| `src/index.css` | 新增编辑器样式 + @media print 样式 |
| `supabase/migration-rich-text.sql` | **新建** — documents 表加 attachments 字段 |

### 新增依赖

```
@tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/pm
```

### 不变的部分

- Supabase Storage 配置（复用 attachments bucket）
- RLS 策略（现有权限完全覆盖）
- 路由结构
- 公告附件的存储方式
