import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { NewsTag } from '../types';
import { Tag, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Terracotta', color: '#df9168' },
  { name: 'Emerald', color: '#1bd96a' },
  { name: 'Sky Blue', color: '#38bdf8' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Rose Red', color: '#f43f5e' },
  { name: 'Amber Gold', color: '#eab308' },
  { name: 'Warm Orange', color: '#f97316' },
  { name: 'Slate Gray', color: '#94a3b8' },
];

export const NewsTagsPage: React.FC = () => {
  const [tags, setTags] = useState<NewsTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<NewsTag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#df9168');
  const [submitting, setSubmitting] = useState(false);

  const loadTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getNewsTags();
      setTags(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load news tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const openCreateModal = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor('#df9168');
    setIsModalOpen(true);
  };

  const openEditModal = (tag: NewsTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      if (editingTag) {
        await adminApi.updateNewsTag(editingTag.id, tagName.trim(), tagColor);
        setSuccess(`Tag "${tagName}" updated!`);
      } else {
        await adminApi.createNewsTag(tagName.trim(), tagColor);
        setSuccess(`Tag "${tagName}" created!`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
      await loadTags();
    } catch (err: any) {
      setError(err.message || 'Failed to save tag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tag: NewsTag) => {
    if (!window.confirm(`Are you sure you want to delete tag "${tag.name}"? Articles with this tag will be unassigned.`)) {
      return;
    }
    setError(null);
    try {
      await adminApi.deleteNewsTag(tag.id);
      setSuccess(`Tag "${tag.name}" deleted`);
      setTimeout(() => setSuccess(null), 2500);
      await loadTags();
    } catch (err: any) {
      setError(err.message || 'Failed to delete tag');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168] mb-1">
            <Tag className="w-4 h-4" />
            <span>Taxonomy</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">News Category Tags</h1>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Organize launcher news and announcements with colorful badges
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl terracotta-gradient hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg w-fit"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Tag</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tags Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm font-mono animate-pulse">
          Loading tags...
        </div>
      ) : tags.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#12141c] border border-white/5 text-center space-y-3">
          <Tag className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No news tags created yet</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-[#df9168]"
          >
            Create first tag
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="p-5 rounded-3xl bg-[#12141c] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black font-mono uppercase tracking-wider shadow-sm"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                      borderColor: `${tag.color}40`,
                      borderWidth: '1px',
                    }}
                  >
                    {tag.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {tag._count?.articles ?? 0} articles
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Slug: <span className="text-slate-300 font-bold">{tag.slug}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                <button
                  onClick={() => openEditModal(tag)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  title="Edit tag"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(tag)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
                  title="Delete tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Tag Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#141720] border border-white/10 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Tag className="w-5 h-5 text-[#df9168]" />
                <h2 className="text-base font-bold text-white uppercase font-mono">
                  {editingTag ? 'Edit Tag' : 'Create Tag'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UPDATE, EVENT, PATCH NOTES"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-[#df9168]"
                />
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2">
                  Tag Badge Color
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setTagColor(p.color)}
                      className={`w-7 h-7 rounded-xl transition-transform border ${
                        tagColor === p.color ? 'scale-110 border-white ring-2 ring-white/20' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: p.color }}
                      title={p.name}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#df9168]"
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Badge Live Preview:
                </span>
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black font-mono uppercase tracking-wider"
                  style={{
                    backgroundColor: `${tagColor}15`,
                    color: tagColor,
                    borderColor: `${tagColor}40`,
                    borderWidth: '1px',
                  }}
                >
                  {tagName || 'TAG PREVIEW'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl terracotta-gradient hover:brightness-110 text-white font-bold text-xs uppercase font-mono transition-all shadow-md"
                >
                  {submitting ? 'Saving...' : editingTag ? 'Save Changes' : 'Create Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
