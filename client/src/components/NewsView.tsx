import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { NewsArticle } from '../types';
import {
  ArrowLeft,
  Calendar,
  Eye,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Newspaper,
  Maximize2,
  X,
  ZoomIn,
} from 'lucide-react';

interface NewsViewProps {
  initialArticle?: NewsArticle | null;
  onClearInitialArticle?: () => void;
}

export const NewsView: React.FC<NewsViewProps> = ({
  initialArticle,
  onClearInitialArticle,
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(initialArticle || null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiService
      .fetchNews()
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialArticle) {
      handleOpenArticle(initialArticle);
    }
  }, [initialArticle]);

  // Handle ESC key for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenArticle = async (article: NewsArticle) => {
    setCurrentImageIndex(0);
    const full = await apiService.fetchArticle(article.id);
    setSelectedArticle(full || article);
    setArticles((prev) =>
      prev.map((a) => (a.id === article.id ? { ...a, viewsCount: a.viewsCount + 1 } : a))
    );
  };

  const handleBack = () => {
    setSelectedArticle(null);
    if (onClearInitialArticle) onClearInitialArticle();
  };

  // Helper Markdown renderer with inspectable and auto-contained images
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Inline Image ![alt](url)
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        const resolvedUrl = apiService.resolveImageUrl(imgMatch[2]);
        return (
          <div key={idx} className="my-6 flex flex-col items-center">
            <div
              onClick={() => setLightboxImage(resolvedUrl)}
              className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950/80 group cursor-zoom-in max-w-full flex items-center justify-center p-1"
            >
              <img
                src={resolvedUrl}
                alt={imgMatch[1]}
                className="max-h-[460px] w-auto max-w-full object-contain rounded-xl transition-all duration-300 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="px-3 py-1.5 rounded-xl bg-black/80 text-white font-mono text-xs font-bold border border-white/20 flex items-center gap-1.5 shadow-lg">
                  <ZoomIn className="w-3.5 h-3.5 text-[#df9168]" />
                  <span>Click to Inspect</span>
                </span>
              </div>
            </div>
            {imgMatch[1] && (
              <p className="text-[11px] font-mono text-slate-400 mt-2 text-center max-w-lg">
                {imgMatch[1]}
              </p>
            )}
          </div>
        );
      }

      // Heading 1 (# ...)
      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-2xl font-black text-white mt-8 mb-4 border-b border-white/10 pb-2">
            {line.replace(/^# /, '')}
          </h1>
        );
      }

      // Heading 2 (## ...)
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-xl font-black text-[#df9168] mt-6 mb-3">
            {line.replace(/^## /, '')}
          </h2>
        );
      }

      // Heading 3 (### ...)
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-white uppercase tracking-wider font-mono mt-5 mb-2">
            {line.replace(/^### /, '')}
          </h3>
        );
      }

      // Blockquote (> ...)
      if (line.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="my-4 pl-4 py-2 border-l-2 border-[#df9168] bg-[#df9168]/5 rounded-r-xl text-xs text-slate-300 font-sans italic"
          >
            {line.replace(/^> /, '')}
          </blockquote>
        );
      }

      // Bullet List (- ... or * ...)
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 my-1.5 font-sans">
            <span className="text-[#df9168] font-bold text-sm leading-none">•</span>
            <span
              dangerouslySetInnerHTML={{
                __html: line
                  .replace(/^[-*] /, '')
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>'),
              }}
            />
          </div>
        );
      }

      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      // Standard Paragraph
      return (
        <p
          key={idx}
          className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans my-2"
          dangerouslySetInnerHTML={{
            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>'),
          }}
        />
      );
    });
  };

  // FULL INLINE ARTICLE VIEW
  if (selectedArticle) {
    let gallery: string[] = [];
    try {
      gallery =
        typeof selectedArticle.images === 'string'
          ? JSON.parse(selectedArticle.images)
          : selectedArticle.images || [];
    } catch {
      gallery = [];
    }
    const allImages = [
      apiService.resolveImageUrl(selectedArticle.coverImage),
      ...gallery
        .filter((url) => url !== selectedArticle.coverImage)
        .map((url) => apiService.resolveImageUrl(url)),
    ];

    const currentImgUrl = allImages[currentImageIndex] || '';

    const nextImage = () => {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    };

    const prevImage = () => {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    return (
      <div className="w-full h-full flex flex-col p-6 sm:p-10 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
        <div className="max-w-4xl mx-auto w-full space-y-6 pb-28">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-mono font-bold uppercase tracking-wider border border-white/10 w-fit group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-[#df9168]" />
            <span>Back to All News</span>
          </button>

          {/* Top Metadata Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {selectedArticle.tag ? (
              <span
                className="px-3 py-1 rounded-full text-[10px] font-black font-mono uppercase tracking-wider shadow-sm"
                style={{
                  backgroundColor: `${selectedArticle.tag.color}15`,
                  color: selectedArticle.tag.color,
                  borderColor: `${selectedArticle.tag.color}40`,
                  borderWidth: '1px',
                }}
              >
                {selectedArticle.tag.name}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 text-slate-400 border border-white/10">
                ANNOUNCEMENT
              </span>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-slate-300">
              <Eye className="w-3.5 h-3.5 text-[#df9168]" />
              <span className="font-bold">{selectedArticle.viewsCount}</span>
              <span className="text-slate-500 text-[10px]">views</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(selectedArticle.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Article Title */}
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            {selectedArticle.title}
          </h1>

          {/* Adaptive Image Carousel with Ambient Blur & Contain */}
          {allImages.length > 0 && (
            <div className="space-y-2">
              <div className="relative w-full h-72 sm:h-96 rounded-3xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl group flex items-center justify-center">
                {/* Ambient Blurred Background for tall or wide images */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
                  <img
                    src={currentImgUrl}
                    alt="Ambient Backdrop"
                    className="w-full h-full object-cover blur-2xl scale-125"
                  />
                </div>

                {/* Contained Main Image (fits high / wide images without cropping) */}
                <img
                  src={currentImgUrl}
                  alt={`Slide ${currentImageIndex + 1}`}
                  onClick={() => setLightboxImage(currentImgUrl)}
                  className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain cursor-zoom-in group-hover:scale-[1.01] transition-transform duration-300"
                />

                {/* Inspect Button overlay */}
                <button
                  onClick={() => setLightboxImage(currentImgUrl)}
                  className="absolute top-4 right-4 z-20 p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-105"
                  title="Inspect full-size image"
                >
                  <Maximize2 className="w-4 h-4 text-[#df9168]" />
                </button>

                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105"
                      title="Previous image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105"
                      title="Next image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 right-4 z-20 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[11px] font-mono text-white border border-white/15 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#df9168]" />
                      <span>
                        {currentImageIndex + 1} / {allImages.length}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {allImages.length > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  {allImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        currentImageIndex === idx
                          ? 'w-6 bg-[#df9168]'
                          : 'w-2 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary Lead Callout (ONLY IF NOT EMPTY) */}
          {selectedArticle.summary && selectedArticle.summary.trim().length > 0 && (
            <div className="p-4 rounded-2xl bg-[#df9168]/10 border border-[#df9168]/20 text-slate-200 text-xs sm:text-sm font-sans leading-relaxed">
              <span className="font-bold text-[#df9168] block uppercase text-[10px] font-mono mb-1">
                Summary
              </span>
              {selectedArticle.summary}
            </div>
          )}

          {/* Markdown Content Body */}
          <div className="space-y-1 text-slate-300 font-sans border-t border-white/5 pt-4">
            {renderMarkdown(selectedArticle.content)}
          </div>
        </div>

        {/* Fullscreen Image Lightbox Inspector */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in p-4 sm:p-8 cursor-zoom-out select-none"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-5 right-5 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all shadow-xl z-10 hover:scale-105"
              title="Close inspector (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
            <div
              className="relative max-h-[90vh] max-w-[92vw] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage}
                alt="Enlarged inspection"
                className="max-h-[88vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-white/15 cursor-default bg-black/40"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ALL NEWS GRID VIEW
  return (
    <div className="w-full h-full flex flex-col p-6 sm:p-10 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
      <div className="max-w-6xl mx-auto w-full space-y-8 pb-28">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#df9168] mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Announcements & Patch Notes</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Realm News Feed
            </h1>
          </div>
          <div className="text-xs text-slate-400 font-mono bg-slate-900/80 px-4 py-2 rounded-xl border border-white/10 w-fit">
            Live Server Feed
          </div>
        </div>

        {/* News Grid */}
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-sm font-mono animate-pulse">
            Loading announcements...
          </div>
        ) : articles.length === 0 ? (
          <div className="p-16 rounded-3xl bg-[#12141c] border border-white/5 text-center space-y-3">
            <Newspaper className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">No news articles yet</h3>
            <p className="text-xs text-slate-400 font-sans">
              Check back soon for upcoming server events, modpack updates, and patch notes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((item) => {
              let gallery: string[] = [];
              try {
                gallery = typeof item.images === 'string' ? JSON.parse(item.images) : item.images || [];
              } catch {}

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenArticle(item)}
                  className="group flex flex-col rounded-3xl overflow-hidden bg-[#12141c] hover:bg-[#151824] border border-white/10 hover:border-[#df9168]/50 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl hover:-translate-y-1"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                    <img
                      src={apiService.resolveImageUrl(item.coverImage)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#12141c] via-transparent to-transparent" />

                    {item.tag && (
                      <div className="absolute top-4 left-4">
                        <span
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black font-mono uppercase tracking-wider backdrop-blur-md shadow-md"
                          style={{
                            backgroundColor: `${item.tag.color}25`,
                            color: item.tag.color,
                            borderColor: `${item.tag.color}50`,
                            borderWidth: '1px',
                          }}
                        >
                          {item.tag.name}
                        </span>
                      </div>
                    )}

                    {gallery.length > 0 && (
                      <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-300 flex items-center gap-1 border border-white/10">
                        <Layers className="w-3 h-3 text-[#df9168]" />
                        <span>+{gallery.length} photos</span>
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-[#df9168]" />
                          <span>{item.viewsCount} views</span>
                        </span>
                      </div>

                      <h2 className="text-base font-bold text-white group-hover:text-[#df9168] transition-colors leading-snug">
                        {item.title}
                      </h2>

                      {/* Summary in grid (only rendered if present) */}
                      {item.summary && item.summary.trim().length > 0 && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                          {item.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-semibold text-[#df9168] group-hover:text-white transition-colors">
                      <span>Read Article</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Image Lightbox Inspector */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in p-4 sm:p-8 cursor-zoom-out select-none"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all shadow-xl z-10 hover:scale-105"
            title="Close inspector (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative max-h-[90vh] max-w-[92vw] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage}
              alt="Enlarged inspection"
              className="max-h-[88vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-white/15 cursor-default bg-black/40"
            />
          </div>
        </div>
      )}
    </div>
  );
};
