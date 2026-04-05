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
