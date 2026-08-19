import React, { useState } from 'react';
import { NewsArticle } from '../types';
import { X, Eye, Calendar, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface NewsReaderModalProps {
  article: NewsArticle | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NewsReaderModal: React.FC<NewsReaderModalProps> = ({
  article,
  isOpen,
  onClose,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!isOpen || !article) return null;

  // Extract all images for carousel (Cover image first, then gallery)
  let gallery: string[] = [];
  try {
    gallery = typeof article.images === 'string' ? JSON.parse(article.images) : article.images || [];
  } catch {
    gallery = [];
  }

  const allImages = [article.coverImage, ...gallery.filter((url) => url !== article.coverImage)];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  // Simple Markdown content renderer for headings, lists, quotes, bold, and embedded images
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Inline Image ![alt](url)
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        return (
          <div key={idx} className="my-4 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img src={imgMatch[2]} alt={imgMatch[1]} className="w-full max-h-96 object-cover" />
            {imgMatch[1] && (
              <p className="text-[11px] font-mono text-center text-slate-500 py-1.5 bg-black/40 border-t border-white/5">
                {imgMatch[1]}
              </p>
            )}
          </div>
        );
      }

      // Heading 1 (# ...)
      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-xl font-black text-white mt-6 mb-3 border-b border-white/10 pb-2">
            {line.replace(/^# /, '')}
          </h1>
        );
      }

      // Heading 2 (## ...)
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-lg font-black text-[#df9168] mt-5 mb-2">
            {line.replace(/^## /, '')}
          </h2>
        );
      }

      // Heading 3 (### ...)
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-white uppercase tracking-wider font-mono mt-4 mb-1.5">
            {line.replace(/^### /, '')}
          </h3>
        );
      }

      // Blockquote (> ...)
      if (line.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="my-3 pl-4 py-2 border-l-2 border-[#df9168] bg-[#df9168]/5 rounded-r-xl text-xs text-slate-300 font-sans italic"
          >
            {line.replace(/^> /, '')}
          </blockquote>
        );
      }

      // Bullet List (- ... or * ...)
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 my-1 font-sans">
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
          className="text-xs text-slate-300 leading-relaxed font-sans my-1.5"
          dangerouslySetInnerHTML={{
            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>'),
          }}
        />
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-[#141720] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Top Header Bar: Metadata (Views & Date) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#10121a]">
          <div className="flex items-center gap-3">
            {/* Category Tag */}
            {article.tag ? (
              <span
                className="px-3 py-1 rounded-full text-[10px] font-black font-mono uppercase tracking-wider shadow-sm"
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
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 text-slate-400 border border-white/10">
                ANNOUNCEMENT
              </span>
            )}

            {/* Views Counter */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-slate-300">
              <Eye className="w-3.5 h-3.5 text-[#df9168]" />
              <span className="font-bold">{article.viewsCount}</span>
              <span className="text-slate-500 text-[10px]">views</span>
            </div>

            {/* Publication Date */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(article.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
          {/* Article Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Interactive Image Carousel */}
          {allImages.length > 0 && (
            <div className="space-y-2">
              <div className="relative w-full h-64 sm:h-80 rounded-3xl overflow-hidden border border-white/10 bg-black shadow-xl group">
                <img
                  src={allImages[currentImageIndex]}
                  alt={`Slide ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover transition-all duration-300"
                />

                {/* Carousel Controls (if > 1 image) */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105"
                      title="Previous image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105"
                      title="Next image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Image Index Badge */}
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[11px] font-mono text-white border border-white/15 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#df9168]" />
                      <span>
                        {currentImageIndex + 1} / {allImages.length}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail Dot Indicators */}
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

          {/* Summary Lead Callout */}
          <div className="p-4 rounded-2xl bg-[#df9168]/10 border border-[#df9168]/20 text-slate-200 text-xs font-sans leading-relaxed">
            <span className="font-bold text-[#df9168] block uppercase text-[10px] font-mono mb-1">
              Summary
            </span>
            {article.summary}
          </div>

          {/* Full Markdown Article Content */}
          <div className="space-y-1 text-slate-300 font-sans border-t border-white/5 pt-4">
            {renderMarkdown(article.content)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#10121a] flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Published on CustomMCLauncher Network
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white transition-colors"
          >
            Close Article
          </button>
        </div>
      </div>
    </div>
  );
};
