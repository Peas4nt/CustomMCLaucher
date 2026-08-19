import React, { useEffect, useState, useRef } from 'react';
import { adminApi } from '../api';
import { modrinthService, ModrinthMeta } from '../services/modrinth';
import { ModpackManifest, FileCategory, ManifestFileEntry } from '../types';
import {
  FolderSync,
  Upload,
  Trash2,
  RefreshCw,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  Power,
  ExternalLink,
  User,
  Copy,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react';

export const FilesPage: React.FC = () => {
  const [manifest, setManifest] = useState<ModpackManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<FileCategory>('mods');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [rescanning, setRescanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingPath, setTogglingPath] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modrinth Metadata Cache for files
  const [modrinthData, setModrinthData] = useState<Record<string, ModrinthMeta | null>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadManifest = async () => {
    try {
      const data = await adminApi.getManifest();
      setManifest(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load manifest');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManifest();
  }, []);

  // Fetch Modrinth metadata asynchronously for all mod files
  useEffect(() => {
    if (!manifest?.categories?.[activeCategory]) return;

    const fetchMeta = async () => {
      const files = manifest.categories[activeCategory];
      for (const file of files) {
        if (!modrinthData[file.path]) {
          modrinthService.fetchModMetadata(file.path).then((meta) => {
            if (meta) {
              setModrinthData((prev) => ({ ...prev, [file.path]: meta }));
            }
          });
        }
      }
    };

    fetchMeta();
  }, [manifest, activeCategory]);

  const handleRescan = async () => {
    setRescanning(true);
    setError(null);
    try {
      const updated = await adminApi.rescanFiles();
      setManifest(updated);
      setSuccess('File system successfully rescanned and SHA-256 hashes generated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Rescan failed');
    } finally {
      setRescanning(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fileArr = Array.from(files);
      await adminApi.uploadFiles(activeCategory, fileArr);
      setSuccess(`Uploaded ${fileArr.length} file(s) into category "${activeCategory}"!`);
      setTimeout(() => setSuccess(null), 3000);
      await loadManifest();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleDisabled = async (category: FileCategory, filePath: string) => {
    setTogglingPath(filePath);
    setError(null);
    try {
      const res = await adminApi.toggleFileDisabled(category, filePath);
      setSuccess(
        res.isDisabled
          ? `Disabled: "${res.newPath}"`
          : `Enabled: "${res.newPath}"`
      );
      setTimeout(() => setSuccess(null), 3000);
      await loadManifest();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle file status');
    } finally {
      setTogglingPath(null);
    }
  };

  const handleDeleteFile = async (category: FileCategory, filename: string) => {
    if (!window.confirm(`Delete "${filename}" from "${category}"?`)) return;
    setError(null);
    try {
      await adminApi.deleteFile(category, filename);
      setSuccess(`Deleted ${filename}`);
      setTimeout(() => setSuccess(null), 2000);
      await loadManifest();
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const currentFiles: ManifestFileEntry[] = manifest?.categories?.[activeCategory] || [];

  const filteredFiles = currentFiles.filter((f) => {
    const meta = f.meta || modrinthData[f.path];
    const matchesSearch =
      f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meta?.title && meta.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (meta?.author && meta.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (meta?.description && meta.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const isDisabled = f.path.endsWith('.disabled');
    if (statusFilter === 'ACTIVE') return matchesSearch && !isDisabled;
    if (statusFilter === 'DISABLED') return matchesSearch && isDisabled;
    return matchesSearch;
  });

  const activeCount = currentFiles.filter((f) => !f.path.endsWith('.disabled')).length;
  const disabledCount = currentFiles.filter((f) => f.path.endsWith('.disabled')).length;

  const categories: { key: FileCategory; label: string; ext: string }[] = [
    { key: 'mods', label: 'Mods', ext: '.jar' },
    { key: 'config', label: 'Configs', ext: '.json, .toml, .txt' },
    { key: 'shaderpacks', label: 'Shaderpacks', ext: '.zip' },
    { key: 'resourcepacks', label: 'Resourcepacks', ext: '.zip' },
  ];

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#df9168]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168] mb-1">
            <FolderSync className="w-4 h-4" />
            <span>Distribution Pipeline</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            File System Indexer
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Manage modpack distribution with live Modrinth project metadata and toggle individual mods without deletion.
          </p>
        </div>

        {/* Rescan Button */}
        <button
          onClick={handleRescan}
          disabled={rescanning}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-white terracotta-gradient hover:brightness-110 shadow-lg transition-all w-fit disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${rescanning ? 'animate-spin' : ''}`} />
          <span>{rescanning ? 'Rescanning SHA-256...' : 'Rescan Index'}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="p-8 rounded-3xl border-2 border-dashed border-white/15 hover:border-[#d97757]/60 bg-[#12141c]/60 hover:bg-[#12141c] transition-all cursor-pointer text-center space-y-3 group shadow-xl"
      >
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />
        <div className="w-14 h-14 rounded-2xl bg-[#1a1d26] border border-white/10 flex items-center justify-center mx-auto text-[#df9168] group-hover:scale-110 transition-transform shadow-md">
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
        </div>
        <div>
          <div className="text-sm font-bold text-white uppercase tracking-wider">
            {uploading
              ? 'Uploading files...'
              : `Click or Drag & Drop files into "${activeCategory.toUpperCase()}" category`}
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Files are automatically placed in <code className="text-[#df9168]">public/files/{activeCategory}/</code> and indexed.
          </p>
        </div>
      </div>

      {/* Category Tabs & Controls */}
      <div className="space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto p-1 rounded-2xl bg-[#141620] border border-white/10 w-fit">
          {categories.map((cat) => {
            const count = manifest?.categories?.[cat.key]?.length || 0;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  setActiveCategory(cat.key);
                  setStatusFilter('ALL');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-[#d97757] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    isActive ? 'bg-black/30 text-white' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter Bar: Status Filters + Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                statusFilter === 'ALL'
                  ? 'bg-white/15 text-white border-white/30 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-transparent hover:text-white'
              }`}
            >
              All ({currentFiles.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-transparent hover:text-emerald-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Active ({activeCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('DISABLED')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                statusFilter === 'DISABLED'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-transparent hover:text-amber-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Disabled ({disabledCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={`Search by mod, author or filename...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#d97757]"
            />
          </div>
        </div>
      </div>

      {/* Modern Mod Cards List */}
      <div className="space-y-3">
        {filteredFiles.map((file) => {
          const isDisabled = file.path.endsWith('.disabled');
          const isTogglingThis = togglingPath === file.path;
          const meta = file.meta || modrinthData[file.path];
          const fileName = file.path.replace(/^[^/]+\//, '');

          return (
            <div
              key={file.path}
              className={`p-5 rounded-3xl bg-[#12141c] border transition-all duration-200 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 group relative overflow-hidden ${
                isDisabled
                  ? 'border-white/5 bg-[#101217] opacity-80'
                  : 'border-white/10 hover:border-[#d97757]/40 hover:bg-[#141722]'
              }`}
            >
              {/* Left Side: Avatar & Details */}
              <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                {/* Mod Avatar / Icon */}
                <div
                  className={`w-14 h-14 rounded-2xl border shrink-0 overflow-hidden flex items-center justify-center p-1 bg-[#161824] shadow-md transition-transform group-hover:scale-105 ${
                    isDisabled ? 'border-white/5 opacity-50' : 'border-white/15'
                  }`}
                >
                  {meta?.iconUrl ? (
                    <img
                      src={meta.iconUrl}
                      alt={meta.title || fileName}
                      className="w-full h-full object-contain rounded-xl"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fb = e.currentTarget.nextElementSibling;
                        if (fb) (fb as HTMLElement).style.display = 'block';
                      }}
                    />
                  ) : null}
                  <FileCode
                    className={`w-6 h-6 ${meta?.iconUrl ? 'hidden' : ''} ${
                      isDisabled ? 'text-slate-600' : 'text-[#df9168]'
                    }`}
                  />
                </div>

                {/* Info Block */}
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Title row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-black text-base tracking-tight transition-colors ${
                        isDisabled
                          ? 'text-slate-400 line-through decoration-amber-500/50'
                          : 'text-white group-hover:text-[#e89d75]'
                      }`}
                    >
                      {meta?.title || fileName}
                    </span>

                    {/* Modrinth Tag Link */}
                    {meta?.projectUrl && (
                      <a
                        href={meta.projectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#1bd96a]/10 text-[#1bd96a] border border-[#1bd96a]/20 hover:bg-[#1bd96a]/20 transition-colors"
                        title="View project on Modrinth"
                      >
                        <span>MODRINTH</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}

                    {/* File Size */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/5 text-slate-300 border border-white/5">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </div>

                  {/* Modrinth Description */}
                  {meta?.description && (
                    <p className="text-xs text-slate-400 line-clamp-1 font-sans">
                      {meta.description}
                    </p>
                  )}

                  {/* Subtitle Line: Author + Real Filename + SHA256 */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400 pt-0.5">
                    {meta?.author && (
                      <span className="text-[#df9168] font-bold flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{meta.author}</span>
                      </span>
                    )}

                    <span className="text-slate-500 text-[11px] truncate max-w-xs sm:max-w-md">
                      {fileName}
                    </span>

                    {/* Copy SHA-256 */}
                    <button
                      onClick={() => copyToClipboard(file.sha256)}
                      className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                      title={`Copy SHA-256: ${file.sha256}`}
                    >
                      {copiedHash === file.sha256 ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                      <span>{copiedHash === file.sha256 ? 'Copied' : `${file.sha256.substring(0, 8)}...`}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Quick Action Controls */}
              <div className="flex items-center justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                {/* Enable / Disable Button */}
                <button
                  onClick={() => handleToggleDisabled(file.category, file.path)}
                  disabled={isTogglingThis}
                  className={`px-4 py-2.5 rounded-2xl border transition-all text-xs font-bold font-mono flex items-center gap-2 shadow-sm ${
                    isDisabled
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/30'
                  }`}
                  title={isDisabled ? 'Click to Enable mod' : 'Click to Disable mod (.disabled)'}
                >
                  {isTogglingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Power
                      className={`w-3.5 h-3.5 ${
                        isDisabled ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                  )}
                  <span>{isDisabled ? 'ENABLE' : 'DISABLE'}</span>
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteFile(file.category, file.path)}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors border border-white/5 shadow-sm"
                  title="Delete file permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredFiles.length === 0 && (
          <div className="p-12 text-center rounded-3xl bg-[#12141c] border border-dashed border-white/10 space-y-3">
            <FileCode className="w-10 h-10 mx-auto text-slate-600" />
            <div className="text-sm font-mono text-slate-400">
              No files found in category "{activeCategory}". Drag & drop files above to upload.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
