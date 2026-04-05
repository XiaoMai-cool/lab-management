# 富文本编辑器 + 文档附件 + PDF 导出 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公告和文档的纯文本编辑升级为 TipTap 富文本编辑器，为文档新增附件上传功能，支持浏览器打印导出 PDF，并为超级管理员显示存储用量。

**Architecture:** 抽取 3 个共享组件（RichTextEditor、FileUploader、FileAttachmentList），公告和文档复用。TipTap 编辑器输出 HTML 存入现有 content 字段，渲染时自动检测 HTML/纯文本兼容旧数据。附件复用 Supabase attachments bucket。

**Tech Stack:** TipTap (React) + Supabase Storage + window.print() + @media print CSS

**性能要求：** TipTap 及扩展 lazy import，编辑器组件按需加载，不影响非编辑页面的加载速度。附件上传显示进度，防止界面卡顿。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/components/RichTextEditor.tsx` | **新建** — TipTap 富文本编辑器，含工具栏 |
| `src/components/RichTextRenderer.tsx` | **新建** — HTML 渲染组件，白名单过滤 + 纯文本兼容 |
| `src/components/FileUploader.tsx` | **新建** — 文件上传组件，进度条、大小校验 |
| `src/components/FileAttachmentList.tsx` | **新建** — 附件列表展示，图片可展开预览 |
| `src/components/StorageUsage.tsx` | **新建** — 存储用量显示（仅超级管理员） |
| `src/lib/types.ts` | **修改** — 新增 FileAttachment 接口，Document 加 attachments |
| `src/lib/sanitize.ts` | **新建** — HTML 白名单过滤函数 |
| `src/pages/admin/AnnouncementManage.tsx` | **修改** — textarea→RichTextEditor，附件上传改用 FileUploader |
| `src/pages/documents/DocumentEdit.tsx` | **修改** — textarea→RichTextEditor，新增附件上传 |
| `src/pages/documents/DocumentView.tsx` | **修改** — 用 RichTextRenderer 渲染，加附件列表和导出 PDF |
| `src/pages/documents/AnnouncementView.tsx` | **修改** — 用 RichTextRenderer 渲染 |
| `src/index.css` | **修改** — 编辑器样式 + @media print 样式 |
| `supabase/migration-rich-text.sql` | **新建** — documents 表加 attachments 字段 |

---

## Task 1: 安装 TipTap 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 TipTap 包**

```bash
cd /Users/xiaomai/Claude/lab-management
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/pm
```

- [ ] **Step 2: 验证安装成功**

```bash
cd /Users/xiaomai/Claude/lab-management
npm ls @tiptap/react
```

Expected: 显示 @tiptap/react 版本号，无 peer dependency 错误。

- [ ] **Step 3: 验证构建不报错**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

Expected: 构建成功，无 TipTap 相关错误。

- [ ] **Step 4: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: add TipTap rich text editor dependencies

@tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-image
EOF
)"
```

---

## Task 2: 类型定义 + HTML 过滤工具

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/sanitize.ts`

- [ ] **Step 1: 在 types.ts 中新增 FileAttachment 接口并更新 Document 类型**

在 `src/lib/types.ts` 中，找到现有的 `AnnouncementAttachment` 接口（约第 24-29 行）：

```typescript
export interface AnnouncementAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}
```

在其下方新增通用的 FileAttachment 接口：

```typescript
// 通用文件附件接口，公告和文档共用
export type FileAttachment = AnnouncementAttachment;
```

找到 Document 接口（约第 46-55 行），给它加上 `attachments` 可选字段：

```typescript
export interface Document {
  id: string;
  title: string;
  category: string;
  content: string;
  author_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  attachments?: FileAttachment[];  // 新增
  author?: { name: string };       // join 查询时
}
```

- [ ] **Step 2: 创建 HTML 过滤函数 `src/lib/sanitize.ts`**

```typescript
// 白名单标签过滤，防御性编程
const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li',
  'a', 'img', 'br', 'hr', 'blockquote',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
};

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

function cleanNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // 保留子节点，移除标签本身
      while (el.firstChild) {
        node.insertBefore(el.firstChild, el);
      }
      el.remove();
      continue;
    }
    // 清理属性
    const allowedAttrs = ALLOWED_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
      if (!allowedAttrs?.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
    // a 标签强制安全属性
    if (tag === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    cleanNode(el);
  }
}

export function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}
```

- [ ] **Step 3: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/lib/types.ts src/lib/sanitize.ts
git commit -m "$(cat <<'EOF'
feat: add FileAttachment type and HTML sanitizer

- FileAttachment type alias for shared use across announcements and documents
- Document type now includes optional attachments field
- sanitizeHtml with whitelist: p, h2, h3, strong, em, ul, ol, li, a, img, br, hr
- isHtmlContent detector for backwards compatibility with plain text
EOF
)"
```

---

## Task 3: RichTextEditor 组件

**Files:**
- Create: `src/components/RichTextEditor.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: 创建 `src/components/RichTextEditor.tsx`**

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, ImageIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  if (!editor) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('图片不能超过 10MB');
      return;
    }
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `editor/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file);
    if (error) {
      alert('图片上传失败: ' + error.message);
      return;
    }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
    // 清空 input 以便再次选择同一文件
    e.target.value = '';
  }

  function handleAddLink() {
    const url = window.prompt('请输入链接地址', 'https://');
    if (!url || !editor) return;
    editor.chain().focus().setLink({ href: url }).run();
  }

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="加粗">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="斜体">
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="标题 H2">
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="标题 H3">
          <Heading3 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="无序列表">
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="有序列表">
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={handleAddLink} className={btnClass(editor.isActive('link'))} title="插入链接">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={btnClass(false)} title="插入图片">
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
      {placeholder && !editor.getText() && (
        <div className="pointer-events-none absolute px-4 py-3 text-gray-400 text-sm" style={{ top: '45px' }}>
          {placeholder}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 在 `src/index.css` 中添加 TipTap 编辑器样式**

在文件末尾添加：

```css
/* TipTap Editor Styles */
.tiptap-content {
  font-size: 0.875rem;
  line-height: 1.625;
  color: #374151;
}
.tiptap-content h2 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.tiptap-content h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.375rem; }
.tiptap-content p { margin: 0.375rem 0; }
.tiptap-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.375rem 0; }
.tiptap-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.375rem 0; }
.tiptap-content li { margin: 0.125rem 0; }
.tiptap-content a { color: #2563eb; text-decoration: underline; }
.tiptap-content img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5rem 0; }
.tiptap-content blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; margin: 0.5rem 0; }
```

- [ ] **Step 3: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/components/RichTextEditor.tsx src/index.css
git commit -m "$(cat <<'EOF'
feat: add RichTextEditor component with TipTap

Lightweight toolbar: bold, italic, H2/H3, lists, link, image upload.
Images upload to Supabase storage. Mobile-friendly scrollable toolbar.
EOF
)"
```

---

## Task 4: RichTextRenderer 组件

**Files:**
- Create: `src/components/RichTextRenderer.tsx`

- [ ] **Step 1: 创建 `src/components/RichTextRenderer.tsx`**

```tsx
import { sanitizeHtml, isHtmlContent } from '../lib/sanitize';

interface RichTextRendererProps {
  content: string;
  className?: string;
}

export default function RichTextRenderer({ content, className = '' }: RichTextRendererProps) {
  if (!content) return null;

  // 纯文本兼容：旧内容无 HTML 标签时按原样渲染
  if (!isHtmlContent(content)) {
    return (
      <div className={`text-gray-700 leading-relaxed whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div
      className={`tiptap-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
    />
  );
}
```

- [ ] **Step 2: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/components/RichTextRenderer.tsx
git commit -m "$(cat <<'EOF'
feat: add RichTextRenderer with HTML sanitization

Auto-detects HTML vs plain text for backwards compatibility.
Sanitizes HTML through tag whitelist before rendering.
EOF
)"
```

---

## Task 5: FileUploader 组件

**Files:**
- Create: `src/components/FileUploader.tsx`

- [ ] **Step 1: 创建 `src/components/FileUploader.tsx`**

从 AnnouncementManage.tsx 中提取文件上传逻辑为独立组件，使用 forwardRef 暴露 uploadAll 给父组件：

```tsx
import { useState, forwardRef, useImperativeHandle } from 'react';
import { Upload, X } from 'lucide-react';
import type { FileAttachment } from '../lib/types';
import { supabase } from '../lib/supabase';

interface FileUploaderProps {
  existingFiles: FileAttachment[];
  onExistingRemove: (index: number) => void;
  storagePath: string; // e.g. 'announcements' or 'documents'
  accept?: string;
  maxSizeMB?: number;
}

export interface FileUploaderHandle {
  uploadAll: () => Promise<FileAttachment[]>;
  hasPendingFiles: () => boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const FileUploader = forwardRef<FileUploaderHandle, FileUploaderProps>(
  function FileUploader({ existingFiles, onExistingRemove, storagePath, accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx', maxSizeMB = 10 }, ref) {
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    async function uploadAll(): Promise<FileAttachment[]> {
      const uploaded: FileAttachment[] = [];
      for (const file of pendingFiles) {
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${storagePath}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from('attachments').upload(path, file);
        if (error) throw new Error(`上传 ${file.name} 失败: ${error.message}`);
        const { data } = supabase.storage.from('attachments').getPublicUrl(path);
        uploaded.push({ name: file.name, url: data.publicUrl, type: file.type, size: file.size });
      }
      setPendingFiles([]);
      return uploaded;
    }

    useImperativeHandle(ref, () => ({
      uploadAll,
      hasPendingFiles: () => pendingFiles.length > 0,
    }));

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
      const selected = Array.from(e.target.files ?? []);
      const maxBytes = maxSizeMB * 1024 * 1024;
      const valid: File[] = [];
      for (const file of selected) {
        if (file.size > maxBytes) {
          alert(`文件 "${file.name}" 超过 ${maxSizeMB}MB 限制`);
        } else {
          valid.push(file);
        }
      }
      setPendingFiles((prev) => [...prev, ...valid]);
      e.target.value = '';
    }

    function removePending(index: number) {
      setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    }

    return (
      <div className="space-y-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <Upload className="w-4 h-4" />
          选择文件
          <input type="file" multiple accept={accept} onChange={handleFileSelect} className="hidden" />
        </label>

        {existingFiles.length > 0 && (
          <div className="space-y-1.5">
            {existingFiles.map((att, index) => (
              <div key={`existing-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 truncate">{att.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                </div>
                <button type="button" onClick={() => onExistingRemove(index)} className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="space-y-1.5">
            {pendingFiles.map((file, index) => (
              <div key={`pending-${index}`} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)} (待上传)</p>
                </div>
                <button type="button" onClick={() => removePending(index)} className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

export default FileUploader;
```

- [ ] **Step 2: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/components/FileUploader.tsx
git commit -m "$(cat <<'EOF'
feat: add FileUploader component with size validation

Reusable file upload with 10MB limit, pending/existing file display.
Uses forwardRef to expose uploadAll() to parent components.
EOF
)"
```

---

## Task 6: FileAttachmentList 组件

**Files:**
- Create: `src/components/FileAttachmentList.tsx`

- [ ] **Step 1: 创建 `src/components/FileAttachmentList.tsx`**

```tsx
import { useState } from 'react';
import { FileText, FileSpreadsheet, FileImage, File, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { FileAttachment } from '../lib/types';

interface FileAttachmentListProps {
  attachments: FileAttachment[];
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('pdf')) return FileText;
  if (type.includes('sheet') || type.includes('excel') || type.includes('.xls')) return FileSpreadsheet;
  if (type.includes('word') || type.includes('.doc')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImage(type: string): boolean {
  return type.startsWith('image/');
}

export default function FileAttachmentList({ attachments }: FileAttachmentListProps) {
  const [expandedImages, setExpandedImages] = useState<Set<number>>(new Set());

  if (!attachments || attachments.length === 0) return null;

  function toggleImage(index: number) {
    setExpandedImages((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
        📎 附件 ({attachments.length})
      </h3>
      <div className="space-y-2">
        {attachments.map((att, index) => {
          const Icon = getFileIcon(att.type);
          const isImg = isImage(att.type);
          const isExpanded = expandedImages.has(index);

          return (
            <div key={index} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Icon className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{att.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {isImg && (
                    <button
                      type="button"
                      onClick={() => toggleImage(index)}
                      className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-0.5"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? '收起' : '展示'}
                    </button>
                  )}
                  <a
                    href={att.url}
                    download={att.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载
                  </a>
                </div>
              </div>
              {/* 图片预览区 */}
              {isImg && isExpanded && (
                <div className="px-3 pb-3">
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-full rounded-md border border-gray-200"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/components/FileAttachmentList.tsx
git commit -m "$(cat <<'EOF'
feat: add FileAttachmentList component

Shows file icon, name, size, download link.
Image attachments have expand/collapse toggle for preview.
EOF
)"
```

---

## Task 7: 数据库迁移 — documents 表加 attachments 字段

**Files:**
- Create: `supabase/migration-rich-text.sql`

- [ ] **Step 1: 创建迁移文件 `supabase/migration-rich-text.sql`**

```sql
-- 文档表新增附件字段
ALTER TABLE documents ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
```

- [ ] **Step 2: 在 Supabase Dashboard 中执行此 SQL（或通过 CLI）**

提醒用户在 Supabase SQL Editor 中执行此迁移。

- [ ] **Step 3: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add supabase/migration-rich-text.sql
git commit -m "$(cat <<'EOF'
feat: add attachments jsonb column to documents table
EOF
)"
```

---

## Task 8: 集成 — AnnouncementManage.tsx 改用富文本编辑器

**Files:**
- Modify: `src/pages/admin/AnnouncementManage.tsx`

这是最大的改动。需要：
1. 将公告编辑的 `<textarea>` 替换为 `RichTextEditor`
2. 将附件上传逻辑替换为 `FileUploader` 组件

- [ ] **Step 1: 添加 lazy import 和替换 textarea**

在文件顶部，将 `RichTextEditor` 用 `React.lazy` 引入（保证性能，编辑器代码按需加载）：

```tsx
import { lazy, Suspense } from 'react';
const RichTextEditor = lazy(() => import('../../components/RichTextEditor'));
```

找到公告编辑表单中的 `<textarea>`（约第 645-651 行）：

```tsx
<textarea
  value={form.content}
  onChange={(e) => setForm({ ...form, content: e.target.value })}
  placeholder="请输入公告内容（支持换行）"
  rows={8}
  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
/>
```

替换为：

```tsx
<Suspense fallback={<div className="h-[200px] bg-gray-50 rounded-lg animate-pulse" />}>
  <RichTextEditor
    content={form.content}
    onChange={(html) => setForm({ ...form, content: html })}
    placeholder="请输入公告内容"
  />
</Suspense>
```

- [ ] **Step 2: 用 FileUploader 替换内联附件上传逻辑**

在文件顶部 import：

```tsx
import FileUploader, { type FileUploaderHandle } from '../../components/FileUploader';
```

添加 ref：

```tsx
const fileUploaderRef = useRef<FileUploaderHandle>(null);
```

找到附件上传区域（约第 720-780 行的文件选择和已有附件展示），替换为：

```tsx
<FileUploader
  ref={fileUploaderRef}
  existingFiles={form.attachments}
  onExistingRemove={removeExistingAttachment}
  storagePath="announcements"
/>
```

在 `handleSave` 函数中，替换原来的 `uploadAllFiles()` 调用：

```tsx
// 原来：const uploaded = await uploadAllFiles();
const uploaded = fileUploaderRef.current
  ? await fileUploaderRef.current.uploadAll()
  : [];
const allAttachments = [...form.attachments, ...uploaded];
```

删除原来的 `uploadAllFiles` 函数、`uploadingFiles` state 和相关的 `removeNewFile` 函数。

- [ ] **Step 3: 验证构建和功能**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

Expected: 构建成功，无类型错误。

- [ ] **Step 4: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/pages/admin/AnnouncementManage.tsx
git commit -m "$(cat <<'EOF'
feat: upgrade announcement editor to TipTap rich text

Replace textarea with lazy-loaded RichTextEditor.
Replace inline file upload with FileUploader component.
EOF
)"
```

---

## Task 9: 集成 — DocumentEdit.tsx 改用富文本 + 附件

**Files:**
- Modify: `src/pages/documents/DocumentEdit.tsx`

- [ ] **Step 1: 添加 imports 和 state**

在文件顶部添加：

```tsx
import { lazy, Suspense, useRef } from 'react';
import FileUploader, { type FileUploaderHandle } from '../../components/FileUploader';
import type { FileAttachment } from '../../lib/types';

const RichTextEditor = lazy(() => import('../../components/RichTextEditor'));
```

在现有 state 下方添加附件 state：

```tsx
const [attachments, setAttachments] = useState<FileAttachment[]>([]);
const fileUploaderRef = useRef<FileUploaderHandle>(null);
```

- [ ] **Step 2: 加载已有附件**

在获取文档数据的 `useEffect` 中（约第 30-45 行），加载附件：

```tsx
// 在 setContent(doc.content) 下方添加
setAttachments((doc.attachments as FileAttachment[]) ?? []);
```

- [ ] **Step 3: 替换 textarea 为 RichTextEditor**

找到文档编辑的 `<textarea>`（约第 180-186 行）：

```tsx
<textarea
  value={content}
  onChange={(e) => setContent(e.target.value)}
  placeholder="请输入文档内容"
  rows={20}
  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
/>
```

替换为：

```tsx
<Suspense fallback={<div className="h-[300px] bg-gray-50 rounded-lg animate-pulse" />}>
  <RichTextEditor
    content={content}
    onChange={setContent}
    placeholder="请输入文档内容"
  />
</Suspense>
```

- [ ] **Step 4: 在表单中添加附件上传区**

在 RichTextEditor 下方添加：

```tsx
{/* 附件上传 */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">附件</label>
  <FileUploader
    ref={fileUploaderRef}
    existingFiles={attachments}
    onExistingRemove={(index) => setAttachments((prev) => prev.filter((_, i) => i !== index))}
    storagePath="documents"
  />
</div>
```

- [ ] **Step 5: 修改保存逻辑，包含附件**

在 `handleSave` 函数中，上传 pending 文件并合并：

```tsx
// 在 supabase insert/update 之前
const uploaded = fileUploaderRef.current
  ? await fileUploaderRef.current.uploadAll()
  : [];
const allAttachments = [...attachments, ...uploaded];
```

在 insert/update 的数据对象中加入 `attachments: allAttachments`：

```tsx
// create 时
const { error } = await supabase.from('documents').insert({
  title, category, content, author_id: profile.id, sort_order: 0,
  attachments: allAttachments,
});

// update 时
const { error } = await supabase.from('documents').update({
  title, category, content, updated_at: new Date().toISOString(),
  attachments: allAttachments,
}).eq('id', id);
```

- [ ] **Step 6: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/pages/documents/DocumentEdit.tsx
git commit -m "$(cat <<'EOF'
feat: upgrade document editor to TipTap with file attachments

Replace textarea with lazy-loaded RichTextEditor.
Add FileUploader for document attachments (PDF/Word/Excel/images).
Attachments stored in documents.attachments jsonb field.
EOF
)"
```

---

## Task 10: 集成 — DocumentView.tsx 渲染 + 附件 + 导出 PDF

**Files:**
- Modify: `src/pages/documents/DocumentView.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: 替换内容渲染为 RichTextRenderer + 添加附件列表**

在文件顶部添加 imports：

```tsx
import RichTextRenderer from '../../components/RichTextRenderer';
import FileAttachmentList from '../../components/FileAttachmentList';
import type { FileAttachment } from '../../lib/types';
import { Printer } from 'lucide-react';
```

找到内容渲染区（约第 127-129 行）：

```tsx
<div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
  {document.content}
</div>
```

替换为：

```tsx
<div className="document-print-content">
  <RichTextRenderer content={document.content} />
  <FileAttachmentList attachments={(document.attachments as FileAttachment[]) ?? []} />
</div>
```

- [ ] **Step 2: 添加"导出 PDF"按钮**

在页面标题区域（PageHeader 或操作按钮区），添加打印按钮：

```tsx
<button
  type="button"
  onClick={() => window.print()}
  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors print:hidden"
>
  <Printer className="w-4 h-4" />
  导出 PDF
</button>
```

- [ ] **Step 3: 在 `src/index.css` 末尾添加 @media print 样式**

```css
/* Print styles for PDF export */
@media print {
  /* 隐藏所有 UI 元素 */
  nav, .bottom-nav, .sub-nav, .print\\:hidden { display: none !important; }
  body { background: white; }

  /* 文档内容全宽 */
  .document-print-content {
    max-width: 100%;
    margin: 0;
    padding: 0;
  }

  /* 隐藏图片预览切换按钮，打印时不展示图片预览 */
  .attachment-toggle { display: none; }

  /* 链接显示 URL */
  .tiptap-content a::after {
    content: " (" attr(href) ")";
    font-size: 0.75rem;
    color: #6b7280;
  }
}
```

- [ ] **Step 4: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/pages/documents/DocumentView.tsx src/index.css
git commit -m "$(cat <<'EOF'
feat: add rich text rendering, attachments, and PDF export to document view

Content rendered with RichTextRenderer (HTML sanitized, plain text compatible).
File attachments with download and image preview toggle.
PDF export via window.print() with clean @media print styles.
EOF
)"
```

---

## Task 11: 集成 — AnnouncementView.tsx 渲染升级

**Files:**
- Modify: `src/pages/documents/AnnouncementView.tsx`

- [ ] **Step 1: 替换内容渲染**

在文件顶部添加：

```tsx
import RichTextRenderer from '../../components/RichTextRenderer';
```

找到内容渲染区（约第 120-122 行）：

```tsx
<div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
  {announcement.content}
</div>
```

替换为：

```tsx
<RichTextRenderer content={announcement.content} />
```

公告附件展示保持现有逻辑不变（已经有图片和文件分开展示）。

- [ ] **Step 2: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/pages/documents/AnnouncementView.tsx
git commit -m "$(cat <<'EOF'
feat: upgrade announcement view to rich text rendering

Use RichTextRenderer for HTML/plain text auto-detection.
Existing attachment display unchanged.
EOF
)"
```

---

## Task 12: StorageUsage 组件（仅超级管理员）

**Files:**
- Create: `src/components/StorageUsage.tsx`
- Modify: `src/pages/admin/AnnouncementManage.tsx`

- [ ] **Step 1: 创建 `src/components/StorageUsage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_STORAGE_MB = 1024; // 1GB free tier

export default function StorageUsage() {
  const [usedMB, setUsedMB] = useState<number | null>(null);

  useEffect(() => {
    calculateUsage();
  }, []);

  async function calculateUsage() {
    let totalBytes = 0;
    // 遍历 attachments bucket 的各子目录
    const folders = ['announcements', 'documents', 'editor', 'reimbursements', 'purchases'];
    for (const folder of folders) {
      const { data } = await supabase.storage.from('attachments').list(folder, { limit: 1000 });
      if (data) {
        for (const file of data) {
          totalBytes += file.metadata?.size ?? 0;
        }
      }
    }
    setUsedMB(totalBytes / (1024 * 1024));
  }

  if (usedMB === null) return null;

  const percentage = Math.min((usedMB / MAX_STORAGE_MB) * 100, 100);
  const isWarning = percentage > 80;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isWarning ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
      <HardDrive className="w-3.5 h-3.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span>存储空间</span>
          <span>{usedMB.toFixed(1)} MB / {MAX_STORAGE_MB} MB</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 AnnouncementManage.tsx 中为超级管理员显示**

在 `AnnouncementManage.tsx` 顶部添加：

```tsx
import StorageUsage from '../../components/StorageUsage';
```

在管理面板合适位置（如 tabs 下方），添加：

```tsx
{isSuperAdmin && <StorageUsage />}
```

其中 `isSuperAdmin` 来自 `useAuth()`。

- [ ] **Step 3: 验证构建**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add src/components/StorageUsage.tsx src/pages/admin/AnnouncementManage.tsx
git commit -m "$(cat <<'EOF'
feat: add storage usage indicator for super admins

Shows used/total storage with progress bar.
Warning highlight when usage exceeds 80%.
Visible only to super_admin role in management panel.
EOF
)"
```

---

## Task 13: 最终验证和清理

**Files:**
- All modified files

- [ ] **Step 1: 完整构建测试**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run build
```

Expected: 构建成功，无错误，无 warning。

- [ ] **Step 2: 检查 bundle 大小**

```bash
cd /Users/xiaomai/Claude/lab-management
ls -lh dist/assets/*.js | head -10
```

确认 TipTap 相关代码被 code-split（lazy import），不影响首屏加载。

- [ ] **Step 3: 本地运行验证**

```bash
cd /Users/xiaomai/Claude/lab-management
npm run dev
```

手动检查：
- 公告编辑：富文本工具栏正常，加粗/标题/列表可用
- 文档编辑：富文本 + 附件上传
- 文档查看：HTML 渲染正确，附件列表正常，图片展示/收起
- 公告查看：旧纯文本内容正常显示
- 导出 PDF：打印预览干净，只有内容
- 存储用量：超级管理员可见

- [ ] **Step 4: 确保 .superpowers/ 在 .gitignore 中**

```bash
cd /Users/xiaomai/Claude/lab-management
grep -q '.superpowers' .gitignore || echo '.superpowers/' >> .gitignore
```

- [ ] **Step 5: Final commit**

```bash
cd /Users/xiaomai/Claude/lab-management
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```
