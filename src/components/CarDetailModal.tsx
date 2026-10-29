import React, { useState } from 'react';
import { CarListing } from '../types/car';
import { toPersianDigits } from '../utils/dataPruner';
import { getListingImage } from '../utils/imageHelper';
import {
  X,
  Phone,
  Lock,
  FileText,
  Copy,
  Check,
  Eye,
  EyeOff,
  Palette,
  Gauge,
  Settings,
  Sparkles,
  Share2,
} from 'lucide-react';

interface CarDetailModalProps {
  listing: CarListing | null;
  isOpen: boolean;
  onClose: () => void;
  isUnlockedColleague: boolean;
  onRequestUnlock: () => void;
}

export const CarDetailModal: React.FC<CarDetailModalProps> = ({
  listing,
  isOpen,
  onClose,
  isUnlockedColleague,
  onRequestUnlock,
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  if (!isOpen || !listing) return null;

  const isSale = listing.type === 'sale';
  const fullText = listing.fileDescription || listing.description || '';

  const handleCopyPhone = () => {
    if (listing.phoneNumber) {
      navigator.clipboard?.writeText(listing.phoneNumber);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleCopyText = () => {
    if (fullText) {
      navigator.clipboard?.writeText(fullText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Zero-scroll Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg h-[92vh] max-h-[720px] bg-neutral-950 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between"
      >
        {/* Top Floating Control Bar */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded-2xl font-black text-sm backdrop-blur-md border border-white/20 shadow-lg transition-transform active:scale-95 cursor-pointer"
            aria-label="بستن پنجره"
          >
            <span>بستن</span>
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {!listing.isTextOnly && (
              <button
                type="button"
                onClick={() => setShowOverlay(!showOverlay)}
                className="flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black/80 text-white rounded-2xl text-xs font-bold backdrop-blur-md border border-white/20 shadow-md cursor-pointer transition-colors"
                title={showOverlay ? 'مخفی کردن نوشته‌ها برای دیدن کامل عکس خودرو' : 'نمایش مجدد مشخصات روی عکس'}
              >
                {showOverlay ? <EyeOff className="w-4 h-4 text-amber-300" /> : <Eye className="w-4 h-4 text-emerald-400" />}
                <span>{showOverlay ? 'دیدن کامل عکس' : 'نمایش کادر'}</span>
              </button>
            )}

            <span
              className={`text-xs font-black px-3 py-1.5 rounded-xl backdrop-blur-md shadow-md border ${
                isSale
                  ? 'bg-blue-600/80 text-white border-blue-400/40'
                  : 'bg-emerald-600/80 text-white border-emerald-400/40'
              }`}
            >
              {isSale ? 'فروشی' : 'خرید'}
            </span>
          </div>
        </div>

        {/* Content Area */}
        {listing.isTextOnly ? (
          /* ==============================================================
             1. TEXT-ONLY LISTING VIEW: Complete verbatim text cleanly shown
             ============================================================== */
          <div className="w-full h-full flex flex-col bg-neutral-900 text-white pt-16 p-4 sm:p-6 overflow-hidden justify-between">
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                      {listing.model}
                    </h2>
                    <span className="text-xs font-bold text-slate-400">
                      مدل {toPersianDigits(listing.year)} • {listing.city}
                    </span>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono bg-neutral-800 px-3 py-1 rounded-xl border border-emerald-500/30 inline-block">
                    {listing.priceFormatted}
                  </span>
                </div>
              </div>

              {/* Title & Badge */}
              <div className="flex items-center justify-between py-1 border-b border-white/10 mb-3">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  متن کامل پیام و محتوای فایل آگهی:
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'کپی شد' : 'کپی کل متن'}</span>
                </button>
              </div>
            </div>

            {/* Complete Verbatim Text Box - Scrollable if long, fully readable */}
            <div className="flex-1 min-h-0 bg-neutral-950/80 rounded-2xl p-4 border border-white/15 overflow-y-auto my-2 select-text">
              <p className="text-sm sm:text-base font-medium text-slate-100 leading-loose text-right dir-rtl whitespace-pre-wrap">
                {fullText || 'متنی برای این آگهی یافت نشد.'}
              </p>
            </div>

            {/* Quick Specs & Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold flex-wrap">
                <span className="bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-slate-300" />
                  {listing.color}
                </span>
                <span className="bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-slate-300" />
                  {listing.mileageFormatted}
                </span>
                <span className="bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 text-slate-300" />
                  {listing.gearbox}
                </span>
              </div>

              {/* Call Action */}
              {isUnlockedColleague ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${listing.phoneNumber}`}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>تماس مستقیم ({listing.phoneNumber})</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="p-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
                    title="کپی شماره تماس"
                  >
                    {copiedPhone ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onRequestUnlock}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-sm sm:text-base rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-5 h-5 text-slate-900" />
                  <span>شماره تماس: مخصوص همکاران (کلیک جهت ورود با رمز)</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ==============================================================
             2. IMAGE LISTING VIEW: Ultra-translucent glass overlay & pure photo
             ============================================================== */
          <div
            className="relative w-full h-full flex items-center justify-center bg-neutral-950 cursor-pointer overflow-hidden"
            onClick={() => setShowOverlay(!showOverlay)}
            title="برای دیدن عکس کامل بدون نوشته، روی عکس بزنید"
          >
            {/* The Crisp Car Photo - Unblurred, fills background so it is clearly visible through the glass */}
            <img
              src={getListingImage(listing, true)}
              alt={listing.title}
              className={`w-full h-full transition-all duration-200 select-none ${
                showOverlay ? 'object-cover' : 'object-contain'
              }`}
              loading="eager"
            />

            {/* Ultra-Translucent Glass Card (کاملاً شیشه‌ای که ماشین پشت آن پیداست) */}
            {showOverlay && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 backdrop-blur-md bg-black/20 hover:bg-black/30 transition-colors border border-white/25 rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-white shadow-2xl space-y-2 animate-in fade-in duration-150"
              >
                {/* Row 1: Car Name, Year, and Price */}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-white leading-tight [text-shadow:_0_1px_3px_rgba(0,0,0,0.9)]">
                      {listing.model}
                      <span className="text-xs font-bold text-slate-100 mr-2 [text-shadow:_0_1px_3px_rgba(0,0,0,0.9)]">
                        مدل {toPersianDigits(listing.year)} • {listing.city}
                      </span>
                    </h2>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-sm sm:text-base font-black text-emerald-300 font-mono bg-black/45 px-2.5 py-0.5 rounded-lg border border-emerald-400/40 shadow-xs">
                      {listing.priceFormatted}
                    </span>
                  </div>
                </div>

                {/* Row 2: Full Complete Description on Glass (بدون خلاصه‌سازی، متن کامل) */}
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-2.5 border border-white/15 text-xs sm:text-sm text-slate-100 font-medium leading-relaxed max-h-36 overflow-y-auto">
                  <div className="flex items-start justify-between gap-1.5 mb-1 border-b border-white/10 pb-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-200">
                      <FileText className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                      <span>متن کامل آگهی و فایل:</span>
                    </div>
                    {fullText && (
                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedText ? 'کپی شد' : 'کپی'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-right dir-rtl leading-relaxed whitespace-pre-wrap select-text [text-shadow:_0_1px_2px_rgba(0,0,0,0.9)]">
                    {fullText || 'توضیحات تکمیلی ثبت نشده است.'}
                  </p>
                </div>

                {/* Row 3: Quick Specs Chips on Glass */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-100 font-semibold flex-wrap">
                  <span className="bg-black/45 border border-white/20 px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                    <Palette className="w-3 h-3 text-slate-200" />
                    {listing.color}
                  </span>
                  <span className="bg-black/45 border border-white/20 px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                    <Gauge className="w-3 h-3 text-slate-200" />
                    {listing.mileageFormatted}
                  </span>
                  <span className="bg-black/45 border border-white/20 px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                    <Settings className="w-3 h-3 text-slate-200" />
                    {listing.gearbox}
                  </span>
                </div>

                {/* Row 4: Call Action or Colleague Unlock */}
                <div className="pt-0.5">
                  {isUnlockedColleague ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${listing.phoneNumber}`}
                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                        <span>تماس مستقیم ({listing.phoneNumber})</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleCopyPhone}
                        className="p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
                        title="کپی شماره"
                      >
                        {copiedPhone ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequestUnlock}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-slate-900" />
                      <span>شماره تماس: مخصوص همکاران (کلیک جهت ورود)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
