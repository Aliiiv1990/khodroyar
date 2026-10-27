import React, { useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, Mic, MicOff, AlertCircle, Sparkles } from 'lucide-react';
import { FilterOptions } from '../types/car';
import { parseVoiceSearchQuery } from '../utils/voiceAssistant';
import { requestMicrophoneAccess } from '../utils/microphoneHelper';
import { MicrophonePermissionModal } from './MicrophonePermissionModal';

interface SearchBarAndFiltersProps {
  filters: FilterOptions;
  onFilterChange: (newFilters: FilterOptions) => void;
  totalMatches: number;
}

const POPULAR_BRANDS = [
  'همه',
  'پژو',
  'سایپا',
  'ایران خودرو',
  'پراید',
  'دنا',
  'تارا',
  'کوییک',
  'شاهین',
  'هایما',
  'جک',
  'هیوندای',
];

const PRICE_RANGES = [
  { id: 'all', label: 'همه قیمت‌ها' },
  { id: 'under300', label: 'زیر ۳۰۰ میلیون' },
  { id: '300to600', label: '۳۰۰ تا ۶۰۰ م' },
  { id: '600to1000', label: '۶۰۰ م تا ۱ میلیارد' },
  { id: 'above1000', label: 'بالای ۱ میلیارد' },
];

export const SearchBarAndFilters: React.FC<SearchBarAndFiltersProps> = ({
  filters,
  onFilterChange,
  totalMatches,
}) => {
  // Local input state for smooth typing without lag
  const [inputValue, setInputValue] = useState(filters.searchQuery);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Voice Search State
  const [isListening, setIsListening] = useState(false);
  const [voiceSummary, setVoiceSummary] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const recognitionRef = useRef<any>(null);

  // Keep local input in sync if filters.searchQuery changes externally (e.g. reset)
  useEffect(() => {
    setInputValue(filters.searchQuery);
  }, [filters.searchQuery]);

  // 300ms Debounce to prevent CPU stutter on low-end phones
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== filters.searchQuery) {
        onFilterChange({ ...filters, searchQuery: inputValue });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, filters, onFilterChange]);

  const handleClearSearch = () => {
    setInputValue('');
    setVoiceSummary('');
    onFilterChange({ ...filters, searchQuery: '' });
  };

  const handleBrandSelect = (brandName: string) => {
    const selectedBrand = brandName === 'همه' ? '' : brandName;
    onFilterChange({ ...filters, brand: selectedBrand });
  };

  const handlePriceSelect = (priceId: FilterOptions['priceRange']) => {
    onFilterChange({ ...filters, priceRange: priceId });
  };

  // Microphone Permission Modal State
  const [showMicModal, setShowMicModal] = useState(false);

  const applyVoiceSearch = (transcript: string) => {
    const parsed = parseVoiceSearchQuery(transcript);
    const finalQuery = parsed.normalizedQuery;
    setInputValue(finalQuery);
    setVoiceSummary(parsed.summaryMessage);
    onFilterChange({ ...filters, searchQuery: finalQuery });
    setVoiceNotice(`متوجه شدم: ${parsed.summaryMessage}`);
    setTimeout(() => setVoiceNotice(''), 5000);
  };

  const startRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice('مرورگر شما از جستجوی صوتی پشتیبانی نمی‌کند (در کروم و اندروید پشتیبانی می‌شود).');
      setShowMicModal(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice('در حال گوش دادن به صدای شما... (مثلاً بگویید: ۲۰۶ تیپ ۲ مدل ۴۰۰)');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        applyVoiceSearch(transcript);
        setIsListening(false);
      };

      recognition.onerror = (e: any) => {
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setVoiceNotice('دسترسی به میکروفون مسدود است.');
          setShowMicModal(true);
        } else if (e.error !== 'no-speech') {
          setVoiceNotice('خطا در دریافت صدا، لطفاً مجدداً امتحان کنید.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setVoiceNotice('امکان فعال‌سازی میکروفون وجود ندارد.');
      setShowMicModal(true);
    }
  };

  // Voice Search Handler (Browser-Native Web Speech API - Google STT)
  const handleToggleVoiceSearch = async () => {
    setVoiceNotice('');

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // Explicitly prompt browser's native permission modal first
    const micRes = await requestMicrophoneAccess();
    if (micRes.status === 'granted') {
      startRecognition();
    } else {
      setVoiceNotice(micRes.message || 'دسترسی به میکروفون داده نشد.');
      setShowMicModal(true);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-2 pb-3 border-b border-slate-200/80 shadow-xs space-y-2.5">
      {/* Large Sticky Search Input with Integrated Voice Search */}
      <div className="relative">
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="جستجوی سریع در ۵,۰۰۰ آگهی (یا دکمه میکروفون را بزنید)..."
          className="w-full bg-white text-slate-900 pr-11 pl-32 py-3 sm:py-3.5 rounded-2xl border-2 border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm sm:text-base font-semibold placeholder:text-slate-400 shadow-xs transition-colors"
        />

        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Clear Search Button */}
          {inputValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              aria-label="پاک کردن متن جستجو"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Voice Search Microphone Button */}
          <button
            type="button"
            onClick={handleToggleVoiceSearch}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-md ring-4 ring-red-200'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
            title="جستجوی صوتی (بگویید تا جستجو کند)"
            aria-label="جستجوی صوتی"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline text-xs font-black">
              {isListening ? 'در حال شنیدن...' : 'صوتی'}
            </span>
          </button>

          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              showAdvancedFilters || filters.brand || filters.priceRange !== 'all' || filters.dayFilter !== 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            aria-label="فیلترهای پیشرفته"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">فیلترها</span>
          </button>
        </div>
      </div>

      {/* Voice Status Pill / Live Notification */}
      {voiceNotice && (
        <div
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            isListening
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {isListening ? (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span className="leading-tight">{voiceNotice}</span>
        </div>
      )}

      {/* Brand Horizontal Scroll Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {POPULAR_BRANDS.map((brand) => {
          const isSelected = (!filters.brand && brand === 'همه') || filters.brand === brand;
          return (
            <button
              key={brand}
              type="button"
              onClick={() => handleBrandSelect(brand)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {brand}
            </button>
          );
        })}
      </div>

      {/* Expandable Advanced Filters (Price and Day) */}
      {showAdvancedFilters && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3 animate-in fade-in duration-150">
          {/* Price Range */}
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1.5">محدوده قیمت:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_RANGES.map((pr) => {
                const isSelected = filters.priceRange === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => handlePriceSelect(pr.id as FilterOptions['priceRange'])}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Filter */}
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1.5">بازه زمانی آگهی:</span>
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'کل ۴ روز گذشته' },
                { id: 'today', label: 'فقط امروز' },
                { id: 'yesterday', label: 'دیروز' },
                { id: 'older', label: '۲ و ۳ روز قبل' },
              ].map((d) => {
                const isSelected = filters.dayFilter === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onFilterChange({ ...filters, dayFilter: d.id as FilterOptions['dayFilter'] })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Microphone Permission Guidance Modal */}
      <MicrophonePermissionModal
        isOpen={showMicModal}
        onClose={() => setShowMicModal(false)}
        onPermissionGranted={() => {
          setShowMicModal(false);
          startRecognition();
        }}
        onSelectSampleVoice={(sampleQuery) => {
          applyVoiceSearch(sampleQuery);
        }}
      />
    </div>
  );
};
