import { useState } from 'react';
import { FileText, ExternalLink, X } from 'lucide-react';

interface FileItem {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

interface FilePreviewProps {
  files: FileItem[];
  title?: string;
}

function isImage(file: FileItem): boolean {
  if (file.type?.startsWith('image/')) return true;
  const ext = file.url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

export default function FilePreview({ files, title }: FilePreviewProps) {
  const [expandedImg, setExpandedImg] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <>
      <div>
        {title && (
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            {title}（{files.length}）
          </p>
        )}
        <div className="space-y-1.5">
          {files.map((file, idx) =>
            isImage(file) ? (
              <div key={idx} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setExpandedImg(file.url)}
                  className="block rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                >
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-h-48 w-auto object-contain bg-gray-50"
                    loading="lazy"
                  />
                </button>
                <p className="text-[10px] text-gray-400 truncate">{file.name}</p>
              </div>
            ) : (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs hover:bg-gray-100 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700 truncate flex-1">{file.name}</span>
                <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
              </a>
            )
          )}
        </div>
      </div>

      {expandedImg && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImg(null)}
        >
          <button
            onClick={() => setExpandedImg(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={expandedImg}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
