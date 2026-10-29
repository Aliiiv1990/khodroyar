import React from 'react';
import { CarListing } from '../types/car';
import { LazyThumbnail } from './LazyThumbnail';
import { toPersianDigits } from '../utils/dataPruner';
import { getListingImage } from '../utils/imageHelper';
import { Phone, Lock, FileText, ChevronLeft, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';

interface CarCardProps {
  listing: CarListing;
  isUnlockedColleague: boolean;
  onOpenDetails: (listing: CarListing) => void;
  onRequestUnlock: () => void;
}

export const CarCard: React.FC<CarCardProps> = React.memo(({
  listing,
  isUnlockedColleague,
  onOpenDetails,
  onRequestUnlock,
}) => {
  const isSale = listing.type === 'sale';
  const isUserSubmitted = listing.source === 'user';
  const fileText = listing.fileDescription || listing.description || '';

  return (
    <div
      onClick={() => onOpenDetails(listing)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onOpenDetails(listing);
        }
      }}
      className={`group relative rounded-2xl transition-all duration-150 p-3 sm:p-3.5 cursor-pointer select-none active:scale-[0.99] flex flex-col justify-between ${
        isUserSubmitted
          ? 'bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border-2 border-indigo-300/90 shadow-sm hover:border-indigo-400 hover:shadow-md'
          : 'bg-white border border-slate-200/90 shadow-xs hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Square Thumbnail (or Text File Icon for text-only files) */}
        {listing.isTextOnly ? (
          <div
            className={`w-[80px] h-[80px] min-w-[80px] min-h-[80px] rounded-xl flex flex-col items-center justify-center shrink-0 shadow-xs ${
              isUserSubmitted
                ? 'bg-indigo-100/90 border border-indigo-300 text-indigo-800'
                : 'bg-amber-50 border border-amber-200/90 text-amber-700'
            }`}
          >
            {isUserSubmitted ? (
              <UserCheck className="w-8 h-8 text-indigo-600 stroke-[1.8]" />
            ) : (
              <FileText className="w-8 h-8 text-amber-600 stroke-[1.8]" />
            )}
            <span
              className={`text-[10px] font-black mt-0.5 ${
                isUserSubmitted ? 'text-indigo-900' : 'text-amber-800'
              }`}
            >
              {isUserSubmitted ? 'ثبت همکار' : 'فایل متنی'}
            </span>
          </div>
        ) : (
          <div className="relative shrink-0">
            <LazyThumbnail
              base64Src={getListingImage(listing, false)}
              alt={listing.model}
              size={80}
            />
            {isUserSubmitted && (
              <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white p-1 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3" />
              </span>
            )}
          </div>
        )}

        {/* Minimal Info Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* 1. Car Name, Year, and Source Badges */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <h3
              className={`text-base sm:text-lg font-black transition-colors line-clamp-1 ${
                isUserSubmitted
                  ? 'text-indigo-950 group-hover:text-indigo-600'
                  : 'text-slate-900 group-hover:text-blue-600'
              }`}
            >
              {listing.model}
              <span className="text-slate-500 font-bold text-sm mr-2">
                - مدل {toPersianDigits(listing.year)}
              </span>
            </h3>

            <div className="flex items-center gap-1 shrink-0">
              {isUserSubmitted ? (
                <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-0.5 shadow-2xs">
                  <UserCheck className="w-3 h-3 text-indigo-600" />
                  <span>ثبت همکار/کاربر</span>
                </span>
              ) : null}

              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                  isSale
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                }`}
              >
                {isSale ? 'فروشی' : 'خرید'}
              </span>
            </div>
          </div>

          {/* 2. Filename Text / Description */}
          <div
            className={`flex items-start gap-1 text-xs sm:text-sm font-medium line-clamp-2 leading-relaxed p-1.5 rounded-lg border ${
              isUserSubmitted
                ? 'bg-indigo-50/70 border-indigo-100/90 text-indigo-950'
                : 'bg-slate-50 border-slate-100 text-slate-600'
            }`}
          >
            {isUserSubmitted ? (
              <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            )}
            <span
              className={`line-clamp-2 dir-rtl text-right ${
                isUserSubmitted ? 'text-indigo-950 font-semibold' : 'text-slate-700'
              }`}
            >
              {fileText || 'بدون توضیحات فایل'}
            </span>
          </div>

          {/* 3. Minimal Price & Quick Status */}
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="font-black text-blue-700 text-sm sm:text-base">
              {listing.priceFormatted}
            </span>
            <span className="text-slate-400 font-medium text-[11px] flex items-center gap-0.5">
              <span>مشاهده روی عکس</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Phone Call / Colleague Action */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
        {isUnlockedColleague ? (
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 dir-ltr font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{listing.phoneNumber}</span>
            </div>

            <a
              href={`tel:${listing.phoneNumber}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-black shadow-sm transition-colors cursor-pointer"
              aria-label={`تماس با شماره ${listing.phoneNumber}`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>تماس مستقیم</span>
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestUnlock();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3 text-amber-600" />
              <span>شماره تماس: مخصوص همکاران</span>
              <span className="text-[10px] underline text-amber-700 mr-0.5">(ورود)</span>
            </button>

            <span className="text-[11px] text-slate-400">
              {listing.city}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

CarCard.displayName = 'CarCard';
