import React from 'react';
import { CarListingType } from '../types/car';
import { toPersianDigits } from '../utils/dataPruner';
import {
  Car,
  ShoppingBag,
  ShieldCheck,
  Lock,
  Database,
  Settings,
  Plus,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { isRunningInIframe } from '../utils/microphoneHelper';
import { UserAuthRole } from './ColleagueAuthModal';

interface HeaderAndTabsProps {
  activeType: CarListingType;
  onTypeChange: (type: CarListingType) => void;
  saleCount: number;
  buyCount: number;
  isUnlockedColleague: boolean;
  userRole?: UserAuthRole;
  onRequestColleagueModal: () => void;
  onToggleColleagueLock: () => void;
  onOpenDataManager: () => void;
  onOpenSettings: () => void;
  onOpenNewListing: () => void;
}

export const HeaderAndTabs: React.FC<HeaderAndTabsProps> = ({
  activeType,
  onTypeChange,
  saleCount,
  buyCount,
  isUnlockedColleague,
  userRole = 'guest',
  onRequestColleagueModal,
  onToggleColleagueLock,
  onOpenDataManager,
  onOpenSettings,
  onOpenNewListing,
}) => {
  return (
    <header className="space-y-3 pt-3">
      {/* Top Navbar: Compact on mobile so all buttons fit without overflow */}
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {/* Brand: Very compact on mobile as requested */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Car className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-1 whitespace-nowrap">
              <span>آگهی‌های خودرو</span>
              <span className="hidden md:inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-800">
                فوق‌سریع
              </span>
            </h1>
            <p className="hidden md:block text-[10px] font-semibold text-slate-400 truncate">
              ۵,۰۰۰ آگهی فعال در ۴ روز گذشته
            </p>
          </div>
        </div>

        {/* Action Buttons: Compact icons & responsive labels so colleague login button never gets pushed off screen */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Prominent Add Listing Button */}
          <button
            type="button"
            onClick={onOpenNewListing}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
            title="ثبت آگهی صوتی یا دستی"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>ثبت</span>
            <span className="hidden sm:inline">آگهی</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1 p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg sm:rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
            title="تنظیمات اندازه فونت و برنامه"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            <span className="hidden lg:inline text-xs">تنظیمات</span>
          </button>

          <button
            type="button"
            onClick={onOpenDataManager}
            className={`flex items-center gap-1 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              userRole === 'admin'
                ? 'bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700'
            }`}
            title={userRole === 'admin' ? 'پنل مدیریت داده‌ها و انتشار در لیارا' : 'مدیریت داده‌ها'}
          >
            <Database className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${userRole === 'admin' ? 'text-purple-700' : 'text-blue-600'}`} />
            <span className="hidden lg:inline text-xs">داده‌ها</span>
          </button>

          {/* Direct Tab opener for full permissions (microphone, fullscreen, etc.) */}
          {typeof window !== 'undefined' && isRunningInIframe() && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 p-1.5 sm:p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg sm:rounded-xl text-xs font-bold transition-colors border border-blue-200 no-underline cursor-pointer shrink-0"
              title="باز کردن در تب مستقیم (برای فعال‌سازی کامل میکروفون)"
            >
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              <span className="hidden xl:inline text-xs">تب جدید</span>
            </a>
          )}

          {userRole === 'admin' ? (
            <button
              type="button"
              onClick={onToggleColleagueLock}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-xs cursor-pointer shrink-0"
              title="ورود با دسترسی مدیر کل (کلیک برای خروج)"
            >
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200" />
              <span>مدیر</span>
            </button>
          ) : userRole === 'colleague' || isUnlockedColleague ? (
            <button
              type="button"
              onClick={onToggleColleagueLock}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-colors cursor-pointer border border-emerald-300 shrink-0"
              title="ورود با دسترسی همکار (کلیک برای خروج)"
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span>همکار</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequestColleagueModal}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-colors cursor-pointer border border-amber-200 shrink-0"
              title="ورود همکار یا مدیر (مشاهده شماره تماس مالکان)"
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
              <span>ورود</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Prominent Main Category Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => onTypeChange('sale')}
          className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm sm:text-base font-black transition-all cursor-pointer ${
            activeType === 'sale'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>خودروهای فروشی</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeType === 'sale' ? 'bg-blue-100 text-blue-800' : 'bg-slate-300/70 text-slate-700'
            }`}
          >
            {toPersianDigits(saleCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTypeChange('buy_request')}
          className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm sm:text-base font-black transition-all cursor-pointer ${
            activeType === 'buy_request'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>درخواست‌های خرید</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeType === 'buy_request' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/70 text-slate-700'
            }`}
          >
            {toPersianDigits(buyCount)}
          </span>
        </button>
      </div>
    </header>
  );
};
