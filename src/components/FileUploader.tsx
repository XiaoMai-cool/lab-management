import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Upload, X } from 'lucide-react';
import type { FileAttachment } from '../lib/types';
import { supabase } from '../lib/supabase';

interface FileUploaderProps {
  existingFiles: FileAttachment[];
  onExistingRemove: (index: number) => void;
  storagePath: string;
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
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function uploadAll(): Promise<FileAttachment[]> {
      const uploaded: FileAttachment[] = [];
      const total = pendingFiles.length;
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        setUploadProgress({ current: i + 1, total, fileName: file.name });
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${storagePath}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type });
        if (error) throw new Error(`上传 ${file.name} 失败: ${error.message}`);
        const { data } = supabase.storage.from('attachments').getPublicUrl(path);
        uploaded.push({ name: file.name, url: data.publicUrl, type: file.type, size: file.size });
      }
      setUploadProgress(null);
      setPendingFiles([]);
      return uploaded;
    }

    useImperativeHandle(ref, () => ({
      uploadAll,
      hasPendingFiles: () => pendingFiles.length > 0,
    }));

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length === 0) return;
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

    function removePending(index: number) {
      setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    }

    return (
      <div className="space-y-2">
        <input ref={fileInputRef} type="file" multiple accept={accept} onChange={handleFileSelect} className="sr-only" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <Upload className="w-4 h-4" />
          {pendingFiles.length > 0 || existingFiles.length > 0 ? '继续添加' : '选择文件'}
        </button>

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
                <button type="button" onClick={() => removePending(index)} disabled={!!uploadProgress} className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadProgress && (
          <div className="space-y-1.5 p-2 bg-blue-50 rounded-lg">
            <div className="flex justify-between text-xs text-gray-600">
              <span className="truncate">上传中: {uploadProgress.fileName}</span>
              <span className="shrink-0 ml-2">{uploadProgress.current}/{uploadProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default FileUploader;
