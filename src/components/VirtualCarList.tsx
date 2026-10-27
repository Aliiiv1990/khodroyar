import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CarListing } from '../types/car';
import { CarCard } from './CarCard';
import { Car, RefreshCw, Upload, Sparkles, PlusCircle } from 'lucide-react';
import { toPersianDigits } from '../utils/dataPruner';

interface VirtualCarListProps {
  listings: CarListing[];
  totalListingsCount: number;
  isUnlockedColleague: boolean;
  onOpenDetails: (listing: CarListing) => void;
  onRequestUnlock: () => void;
  onResetFilters: () => void;
  onOpenDataManager?: () => void;
  onRegenerateDemo?: () => void;
  onOpenNewListing?: () => void;
}

export const VirtualCarList: React.FC<VirtualCarListProps> = ({
  listings,
  totalListingsCount,
  isUnlockedColleague,
  onOpenDetails,
  onRequestUnlock,
  onResetFilters,
  onOpenDataManager,
  onRegenerateDemo,
  onOpenNewListing,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer setup: only renders visible 10-15 cards (+4 overscan) in DOM
  const rowVirtualizer = useVirtualizer({
    count: listings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // estimated height of card + gap
    overscan: 4,
  });

  // Case 1: Database is completely empty (user cleared all listings)
  if (totalListingsCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-white rounded-3xl border border-slate-200/90 shadow-sm my-4 min-h-[400px]">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 ring-8 ring-blue-50/50">
          <Car className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">
          بانک اطلاعاتی برنامه خالی است
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          تمامی آگهی‌های قبلی با موفقیت پاکسازی شدند. وضعیت خالی بودن در مرورگر شما ذخیره شده و با قطع اینترنت یا رفرش نیز دوباره دیتای تکراری لود نخواهد شد.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          {onOpenDataManager && (
            <button
              type="button"
              onClick={onOpenDataManager}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>تزریق فایل (ZIP / JSON)</span>
            </button>
          )}

          {onOpenNewListing && (
            <button
              type="button"
              onClick={onOpenNewListing}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>ثبت آگهی یا سفارش</span>
            </button>
          )}
        </div>

        {onRegenerateDemo && (
          <button
            type="button"
            onClick={onRegenerateDemo}
            className="mt-4 text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 cursor-pointer py-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>بارگذاری مجدد ۵,۰۰۰ آگهی آزمایشی جهت تست سرعت</span>
          </button>
        )}
      </div>
    );
  }

  // Case 2: Filter yielded no results
  if (listings.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs my-4 min-h-[360px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Car className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-1">
          هیچ آگهی با این مشخصات یافت نشد
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
          می‌توانید فیلترهای جستجو یا قیمت را پاک کنید تا همه آگهی‌های فعال نمایش داده شوند.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>نمایش همه آگهی‌ها</span>
        </button>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scrollable Virtual Container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden pr-1 pl-1 pb-20 scroll-smooth"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = listings[virtualRow.index];
            if (!item) return null;

            return (
              <div
                key={item.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="virtual-row pb-3.5"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <CarCard
                  listing={item}
                  isUnlockedColleague={isUnlockedColleague}
                  onOpenDetails={onOpenDetails}
                  onRequestUnlock={onRequestUnlock}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating status pill showing virtual windowing statistics */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700/60 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>
            نمایش مجازی: {toPersianDigits(virtualItems.length)} کارت در حافظه از مجموع {toPersianDigits(listings.length)} آگهی
          </span>
        </div>
      </div>
    </div>
  );
};
