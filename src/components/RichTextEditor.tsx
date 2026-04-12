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
}

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
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
    const path = `editor/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type });
    if (error) {
      alert('图片上传失败: ' + error.message);
      return;
    }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
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
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
