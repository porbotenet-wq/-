import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { StatusBadge } from '../components/StatusBadge';
import { supabase } from '../api/supabase';

const DOC_TYPE_ICONS: Record<string, string> = {
  PHOTO: '📷',
  PDF: '📄',
  DOCX: '📝',
  XLSX: '📊',
  DWG: '📐',
  JPG: '🖼',
  PNG: '🖼',
  FILE: '📎',
};

const DOC_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Черновик', color: 'bg-gray-500' },
  ON_REVIEW: { label: 'На проверке', color: 'bg-yellow-500' },
  APPROVED: { label: 'Утверждён', color: 'bg-green-500' },
  ARCHIVED: { label: 'В архиве', color: 'bg-gray-600' },
};

export default function Documents() {
  const { project, documents, loadDocuments, user, uploadDocument } = useAppStore();
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!project) return;
    const filters: any = {};
    if (filterType) filters.type = filterType;
    if (filterStatus) filters.status = filterStatus;
    loadDocuments(project.id, filters);
  }, [project, filterType, filterStatus]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    setUploading(true);
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

    await uploadDocument(file, {
      name: file.name,
      type: ext,
    });

    setUploading(false);
    setShowUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function changeDocStatus(docId: number, newStatus: string) {
    if (!user || !project) return;

    await supabase
      .from('documents')
      .update({ status: newStatus })
      .eq('id', docId);

    await supabase.from('audit_logs').insert({
      action: 'DOCUMENT_STATUS_CHANGED',
      entity_type: 'Document',
      entity_id: docId,
      user_id: user.id,
      new_value: { status: newStatus },
    });

    loadDocuments(project.id);
  }

  const docTypes = [...new Set(documents.map((d: any) => d.type))].sort();

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-tg-text">📁 Документы</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-xs bg-tg-button text-tg-buttonText px-3 py-1.5 rounded-lg active:opacity-80"
        >
          + Загрузить
        </button>
      </div>

      {/* Upload area */}
      {showUpload && (
        <div className="bg-tg-secondary rounded-xl p-4 border border-gray-700/30 mb-4 border-dashed">
          <div className="text-center">
            <p className="text-sm text-tg-text mb-2">
              {uploading ? 'Загрузка...' : 'Выберите файл для загрузки'}
            </p>
            <p className="text-[10px] text-tg-hint mb-3">
              PDF, DOCX, XLSX, DWG, JPG, PNG (до 50 МБ)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.dwg,.jpg,.jpeg,.png"
              onChange={handleUpload}
              disabled={uploading}
              className="text-xs text-tg-text"
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          <option value="">Все типы</option>
          {docTypes.map((t) => (
            <option key={t} value={t}>{DOC_TYPE_ICONS[t] || '📎'} {t}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-tg-secondary text-tg-text text-xs px-3 py-1.5 rounded-lg border border-gray-700/30"
        >
          <option value="">Все статусы</option>
          {Object.entries(DOC_STATUS_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-tg-hint mb-3">
        Документов: {documents.length}
      </p>

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc: any) => (
          <DocumentCard key={doc.id} doc={doc} onChangeStatus={changeDocStatus} />
        ))}
        {documents.length === 0 && (
          <div className="text-center text-tg-hint py-12">
            <p className="text-3xl mb-2">📁</p>
            <p>Документы не найдены</p>
            <p className="text-xs mt-1">Загрузите первый документ</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentCard({ doc, onChangeStatus }: { doc: any; onChangeStatus: (id: number, status: string) => void }) {
  const icon = DOC_TYPE_ICONS[doc.type] || '📎';
  const statusCfg = DOC_STATUS_LABELS[doc.status] || { label: doc.status, color: 'bg-gray-500' };
  const uploader = doc.users ? `${doc.users.first_name || ''} ${doc.users.last_name || ''}`.trim() : '—';
  const size = doc.size_bytes ? formatBytes(doc.size_bytes) : '—';
  const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : '—';

  const nextStatus: Record<string, { label: string; status: string }> = {
    DRAFT: { label: '📤 На проверку', status: 'ON_REVIEW' },
    ON_REVIEW: { label: '✅ Утвердить', status: 'APPROVED' },
    APPROVED: { label: '📦 В архив', status: 'ARCHIVED' },
  };

  const action = nextStatus[doc.status];

  return (
    <div className="bg-tg-secondary rounded-xl p-3 border border-gray-700/30">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="text-sm font-medium text-tg-text truncate">{doc.name}</div>
              <div className="text-[10px] text-tg-hint">v{doc.version}</div>
            </div>
            <span className={`${statusCfg.color} text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0`}>
              {statusCfg.label}
            </span>
          </div>

          <div className="flex gap-3 text-[10px] text-tg-hint mt-1">
            <span>👤 {uploader}</span>
            <span>📅 {date}</span>
            <span>💾 {size}</span>
          </div>

          {doc.entity_type && (
            <div className="text-[10px] text-tg-hint mt-1">
              📎 Привязан: {doc.entity_type} #{doc.entity_id}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] bg-tg-bg text-tg-link px-2 py-0.5 rounded"
              >
                📥 Открыть
              </a>
            )}
            {action && (
              <button
                onClick={() => onChangeStatus(doc.id, action.status)}
                className="text-[10px] bg-tg-button/20 text-tg-button px-2 py-0.5 rounded active:opacity-80"
              >
                {action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
