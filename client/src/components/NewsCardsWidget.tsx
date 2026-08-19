import React from 'react';
import { NewsArticle } from '../types';
import { apiService } from '../services/api';
import { Newspaper, ChevronRight, Layers, Calendar, Eye } from 'lucide-react';

interface NewsCardsWidgetProps {
  articles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  onViewAllNews?: () => void;
}

export const NewsCardsWidget: React.FC<NewsCardsWidgetProps> = ({
  articles,
  onSelectArticle,
  onViewAllNews,
}) => {
  if (!articles || articles.length === 0) return null;

  // First 3 news articles rendered vertically (top to bottom) with compact picture on top and text below
  const topNews = articles.slice(0, 3);

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-[420px]">
      {/* Header bar: "NEWS" aligned to the right */}
      <div className="flex items-center justify-between gap-3 px-1 w-full">
        {onViewAllNews ? (
          <button
            onClick={onViewAllNews}
            className="text-[10px] font-mono font-bold text-slate-400 hover:text-white uppercase transition-colors flex items-center gap-1 group"
          >
            <span>All Announcements</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#df9168]">
          <Newspaper className="w-3.5 h-3.5" />
          <span>News</span>
        </div>
      </div>

      {/* Vertical Stack: 3 Ultra-aesthetic Mini Cards */}
      <div className="flex flex-col gap-2.5 w-full">
        {topNews.map((article) => {
          let gallery: string[] = [];
          try {
            gallery = typeof article.images === 'string' ? JSON.parse(article.images) : article.images || [];
          } catch {}

          return (
            <div
              key={article.id}
              onClick={() => onSelectArticle(article)}
              className="group flex flex-col rounded-2xl overflow-hidden bg-[#12141c] hover:bg-[#151822] border border-white/10 hover:border-[#df9168]/60 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.015] transform-gpu backdrop-blur-md shrink-0 w-full"
            >
              {/* Picture on Top */}
              <div className="relative h-16 sm:h-20 w-full overflow-hidden bg-slate-950 shrink-0">
                <img
                  src={apiService.resolveImageUrl(article.coverImage)}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out block"
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12141c] via-[#12141c]/30 to-transparent group-hover:from-[#151822] group-hover:via-[#151822]/30 transition-colors duration-200 pointer-events-none" />

                {/* Category Tag overlay on top-left */}
                {article.tag && (
                  <div className="absolute top-2 left-2">
                    <span
                      className="px-2 py-0.5 rounded-md text-[8px] font-black font-mono uppercase tracking-wider backdrop-blur-md shadow-sm"
                      style={{
                        backgroundColor: `${article.tag.color}25`,
                        color: article.tag.color,
                        borderColor: `${article.tag.color}50`,
                        borderWidth: '1px',
                      }}
                    >
                      {article.tag.name}
                    </span>
                  </div>
                )}

                {/* Gallery photo count overlay on bottom-right */}
                {gallery.length > 0 && (
                  <span className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[8px] font-mono text-slate-300 flex items-center gap-1 border border-white/10">
                    <Layers className="w-2 h-2 text-[#df9168]" />
                    <span>+{gallery.length}</span>
                  </span>
                )}
              </div>

              {/* Text Below */}
              <div className="p-2 sm:p-2.5 space-y-0.5 flex flex-col justify-between flex-1 relative z-10 bg-transparent">
                {/* Meta Row: Date & Views */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-slate-500" />
                    <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Eye className="w-2.5 h-2.5 text-[#df9168]" />
                    <span>{article.viewsCount} views</span>
                  </span>
                </div>

                {/* Title */}
                <h4 className="font-bold text-xs text-white group-hover:text-[#df9168] transition-colors truncate leading-snug">
                  {article.title}
                </h4>

                {/* Truncated Summary: 1 line (only if present) */}
                {article.summary && article.summary.trim().length > 0 && (
                  <p className="text-[10.5px] text-slate-400 font-sans line-clamp-1 leading-snug">
                    {article.summary}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
