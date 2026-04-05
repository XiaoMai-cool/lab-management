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
