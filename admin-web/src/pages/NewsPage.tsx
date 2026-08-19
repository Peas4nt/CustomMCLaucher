import React, { useState, useEffect, useRef } from 'react';
import { adminApi } from '../api';
import { NewsArticle, NewsTag } from '../types';
import {
  Newspaper,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  Upload,
  Loader2,
  FileUp,
} from 'lucide-react';

export const NewsPage: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [tags, setTags] = useState<NewsTag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [tagId, setTagId] = useState<string>('');
  const [published, setPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Upload States & Refs
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [articlesData, tagsData] = await Promise.all([
        adminApi.getNewsAdmin(selectedTagFilter || undefined, searchQuery || undefined),
        adminApi.getNewsTags(),
      ]);
      setArticles(articlesData);
      setTags(tagsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTagFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openCreateModal = () => {
    setEditingArticle(null);
    setTitle('');
    setSummary('');
    setContent('');
    setCoverImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80');
    setGalleryImages([]);
    setNewGalleryUrl('');
    setTagId(tags[0]?.id || '');
    setPublished(true);
    setIsModalOpen(true);
  };

  const openEditModal = (article: NewsArticle) => {
    setEditingArticle(article);
    setTitle(article.title);
    setSummary(article.summary || '');
    setContent(article.content);
    setCoverImage(article.coverImage);
    let parsedImages: string[] = [];
    try {
      parsedImages = typeof article.images === 'string' ? JSON.parse(article.images) : article.images;
    } catch {
      parsedImages = [];
    }
    setGalleryImages(parsedImages);
    setNewGalleryUrl('');
    setTagId(article.tagId || '');
    setPublished(article.published);
    setIsModalOpen(true);
  };

  // Upload Handlers
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setError(null);
    try {
      const res = await adminApi.uploadNewsImage(file);
      setCoverImage(res.url);
      setSuccess('Cover image uploaded successfully!');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const res = await adminApi.uploadNewsImage(files[i]);
        setGalleryImages((prev) => [...prev, res.url]);
      }
      setSuccess(`${files.length} gallery image(s) uploaded!`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload gallery images');
    } finally {
      setUploadingGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingInline(true);
    setError(null);
    try {
      const res = await adminApi.uploadNewsImage(file);
      const snippet = `\n![${file.name.replace(/\.[^/.]+$/, '')}](${res.url})\n`;
      insertMarkdown(snippet);
      setSuccess('Image uploaded and inserted into article text!');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload inline image');
    } finally {
      setUploadingInline(false);
      if (inlineFileInputRef.current) inlineFileInputRef.current.value = '';
    }
  };

  const addGalleryImage = () => {
    if (!newGalleryUrl.trim()) return;
    setGalleryImages((prev) => [...prev, newGalleryUrl.trim()]);
    setNewGalleryUrl('');
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const insertMarkdown = (snippet: string) => {
    setContent((prev) => `${prev}\n${snippet}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !coverImage.trim()) {
      setError('Please fill in title, content and cover image');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        summary: summary.trim(), // Optional; if empty backend will auto-extract from content
        content: content.trim(),
        coverImage: coverImage.trim(),
        images: galleryImages,
        tagId: tagId || null,
        published,
      };

      if (editingArticle) {
        await adminApi.updateArticle(editingArticle.id, payload);
        setSuccess(`Article "${title}" updated successfully!`);
      } else {
        await adminApi.createArticle(payload);
        setSuccess(`Article "${title}" created successfully!`);
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save article');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (article: NewsArticle) => {
    if (!window.confirm(`Delete article "${article.title}"?`)) return;
    setError(null);
    try {
      await adminApi.deleteArticle(article.id);
      setSuccess(`Article deleted`);
      setTimeout(() => setSuccess(null), 2500);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete article');
    }
  };

  const togglePublishedStatus = async (article: NewsArticle) => {
    try {
      await adminApi.updateArticle(article.id, { published: !article.published });
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, published: !a.published } : a))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update article status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168] mb-1">
            <Newspaper className="w-4 h-4" />
            <span>Community & Announcements</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Launcher News & Articles</h1>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Publish rich patch notes, community events, and season launches with image uploads
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl terracotta-gradient hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg w-fit"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Write Article</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-3xl bg-[#12141c] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tag Filters */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedTagFilter('')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all shrink-0 ${
              selectedTagFilter === ''
                ? 'bg-white/15 text-white border border-[#df9168]/50 shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            All Tags
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTagFilter(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all shrink-0 flex items-center gap-1.5 ${
                selectedTagFilter === t.id
                  ? 'bg-white/15 text-white border border-[#df9168]/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-72">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#df9168]"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-slate-300 border border-white/10"
          >
            Filter
          </button>
        </form>
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

      {/* Articles List */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-sm font-mono animate-pulse">
          Loading articles...
        </div>
      ) : articles.length === 0 ? (
        <div className="p-16 rounded-3xl bg-[#12141c] border border-white/5 text-center space-y-3">
          <Newspaper className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No news articles found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans">
            Create your first patch note or announcement to display it on client launchers.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl terracotta-gradient text-white text-xs font-mono font-bold uppercase"
          >
            Create Article
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => {
            let gallery: string[] = [];
            try {
              gallery = typeof article.images === 'string' ? JSON.parse(article.images) : article.images;
            } catch {}

            return (
              <div
                key={article.id}
                className={`p-6 rounded-3xl bg-[#12141c] border transition-all duration-200 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 group relative overflow-hidden ${
                  article.published
                    ? 'border-white/10 hover:border-[#df9168]/40 hover:bg-[#141722]'
                    : 'border-white/5 opacity-70 bg-[#0f1116]'
                }`}
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-start sm:items-center gap-5 min-w-0 flex-1">
                  <div className="w-24 h-20 sm:w-28 sm:h-24 rounded-2xl border border-white/10 overflow-hidden shrink-0 bg-slate-900 shadow-md relative group/thumb">
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80';
                      }}
                    />
                    {gallery.length > 0 && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-mono text-slate-300 flex items-center gap-1 border border-white/10">
                        <Layers className="w-2.5 h-2.5 text-[#df9168]" />
                        <span>+{gallery.length}</span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      {article.tag ? (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                          style={{
                            backgroundColor: `${article.tag.color}15`,
                            color: article.tag.color,
                            borderColor: `${article.tag.color}40`,
                            borderWidth: '1px',
                          }}
                        >
                          {article.tag.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-400 font-bold border border-white/10">
                          GENERAL
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-black/30 px-2 py-0.5 rounded-md border border-white/5">
                        <Eye className="w-3 h-3 text-[#df9168]" />
                        <span>{article.viewsCount} views</span>
                      </span>

                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                      </span>

                      <button
                        onClick={() => togglePublishedStatus(article)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-colors ${
                          article.published
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                        }`}
                        title="Click to toggle status"
                      >
                        {article.published ? 'Published' : 'Draft'}
                      </button>
                    </div>

                    <h3 className="font-black text-base text-white group-hover:text-[#e89d75] transition-colors leading-snug">
                      {article.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 font-sans">
                      {article.summary}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5 w-full lg:w-auto justify-end">
                  <button
                    onClick={() => openEditModal(article)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-slate-300 hover:text-white transition-colors border border-white/10"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(article)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors border border-white/10"
                    title="Delete article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden File Inputs for PC Uploads */}
      <input
        type="file"
        ref={coverFileInputRef}
        onChange={handleCoverUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={galleryFileInputRef}
        onChange={handleGalleryUpload}
        accept="image/*"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={inlineFileInputRef}
        onChange={handleInlineImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Create / Edit Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#141720] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#df9168]/20 text-[#df9168] border border-[#df9168]/30">
                  <Newspaper className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white uppercase font-mono">
                    {editingArticle ? 'Edit News Article' : 'Write News Article'}
                  </h2>
                  <p className="text-xs text-slate-400 font-sans">
                    Publish markdown formatted news with image upload from computer and gallery
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Row 1: Title & Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1">
                    Article Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Steam & Steel: The Industrial Season Launch!"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:outline-none focus:border-[#df9168]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1">
                    Category Tag
                  </label>
                  <select
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#df9168]"
                  >
                    <option value="">No Tag (General)</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cover Image Upload (From PC or URL) */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-slate-300">
                    Main Cover Image * (Header & Preview)
                  </label>
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl terracotta-gradient hover:brightness-110 text-white font-mono font-bold text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    {uploadingCover ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Image</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Upload from computer or paste image URL (https://...)"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#df9168]"
                  />
                </div>

                {coverImage && (
                  <div className="h-40 w-full rounded-2xl border border-white/10 overflow-hidden bg-black relative shadow-md group">
                    <img
                      src={coverImage}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => coverFileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-mono text-xs font-bold"
                    >
                      <Upload className="w-4 h-4 text-[#df9168]" />
                      <span>Change Cover Image</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Summary (OPTIONAL) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono font-bold uppercase text-slate-300">
                    Summary / Short Preview
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">
                    Optional — auto-generated from text if left empty
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Optional 1-2 line summary. If left blank, it will automatically be extracted from your article text."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#df9168]"
                />
              </div>

              {/* Image Carousel Gallery Manager */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#df9168]" />
                    <span className="text-xs font-mono font-bold uppercase text-slate-200">
                      Image Carousel Gallery ({galleryImages.length} images)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => galleryFileInputRef.current?.click()}
                    disabled={uploadingGallery}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono font-bold text-xs border border-white/10 shadow-sm transition-all disabled:opacity-50"
                  >
                    {uploadingGallery ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#df9168]" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-3.5 h-3.5 text-[#df9168]" />
                        <span>Upload Images</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Add Image URL input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or paste gallery image URL (https://...)"
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGalleryImage();
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#df9168]"
                  />
                  <button
                    type="button"
                    onClick={addGalleryImage}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white border border-white/10"
                  >
                    Add URL
                  </button>
                </div>

                {/* Gallery List */}
                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {galleryImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="h-20 rounded-xl border border-white/10 overflow-hidden relative group bg-black shadow-md"
                      >
                        <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="absolute top-1 right-1 p-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown(`![Image](${img})`)}
                          className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#df9168]"
                          title="Insert into text content"
                        >
                          Insert in Text
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Markdown Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="text-xs font-mono font-bold uppercase text-slate-300">
                    Full Article Content (Markdown) *
                  </label>

                  {/* Formatting & Inline Upload Toolbar */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                    <button
                      type="button"
                      onClick={() => inlineFileInputRef.current?.click()}
                      disabled={uploadingInline}
                      className="px-2.5 py-1 rounded-lg bg-[#df9168]/20 hover:bg-[#df9168]/30 text-[#df9168] font-bold border border-[#df9168]/40 flex items-center gap-1 transition-colors"
                    >
                      {uploadingInline ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3" />
                          <span>Upload Image</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('### Section Title')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      + Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('- Feature item 1\n- Feature item 2')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      + List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('> Quote or important announcement callout')}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      + Quote
                    </button>
                  </div>
                </div>

                <textarea
                  ref={contentTextareaRef}
                  required
                  rows={8}
                  placeholder="Write your article in markdown. You can click 'Upload Image to Text' above to upload pictures from your computer directly into the article..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#df9168]"
                />
              </div>

              {/* Published Toggle */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/30 border border-white/5">
                <input
                  type="checkbox"
                  id="published-toggle"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 accent-[#df9168] rounded cursor-pointer"
                />
                <label
                  htmlFor="published-toggle"
                  className="text-xs font-mono font-bold uppercase text-slate-200 cursor-pointer"
                >
                  Publish to launcher immediately (Visible to all players)
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl terracotta-gradient hover:brightness-110 text-white font-bold text-xs uppercase font-mono transition-all shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingArticle ? 'Save Changes' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
