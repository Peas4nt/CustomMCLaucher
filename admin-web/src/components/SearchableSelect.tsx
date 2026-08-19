import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X, Loader2 } from 'lucide-react';

interface Option {
  value: string;
  label?: string;
  badge?: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | Option)[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  allowCustom?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  loading = false,
  allowCustom = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: Option[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const filteredOptions = normalizedOptions.filter(
    (opt) =>
      opt.value.toLowerCase().includes(search.toLowerCase()) ||
      (opt.label && opt.label.toLowerCase().includes(search.toLowerCase()))
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  return (
    <div className="space-y-1.5 w-full relative" ref={containerRef}>
      {label && (
        <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      )}

      {/* Select Box Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 rounded-xl bg-slate-900/90 border transition-all flex items-center justify-between cursor-pointer font-mono text-sm ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-white/5 bg-slate-950 text-slate-500'
            : isOpen
            ? 'border-[#d97757] shadow-[0_0_15px_rgba(217,119,87,0.2)] text-white'
            : 'border-white/10 hover:border-white/20 text-white'
        }`}
      >
        <span className={value ? 'text-white font-bold' : 'text-slate-500'}>
          {selectedOption ? selectedOption.label || selectedOption.value : value || placeholder}
        </span>

        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#df9168]" />}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#df9168]' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-[#141722] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-3 border-b border-white/10 bg-[#10121a]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder="Type to filter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#d97757]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-1 font-mono text-xs">
            {allowCustom && search.trim() && !filteredOptions.some((o) => o.value === search.trim()) && (
              <button
                type="button"
                onClick={() => {
                  onChange(search.trim());
                  setIsOpen(false);
                  setSearch('');
                }}
                className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-[#df9168] bg-[#d97757]/10 hover:bg-[#d97757]/20 transition-colors"
              >
                <span>Use custom: "{search.trim()}"</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}

            {filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#d97757] text-white font-bold shadow-sm'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{opt.label || opt.value}</span>
                    {opt.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/30 text-slate-200">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-500 text-xs">
                No matching versions found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
