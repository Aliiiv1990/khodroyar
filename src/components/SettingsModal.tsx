import React from 'react';
import { X, Type, Check, Eye, Sparkles } from 'lucide-react';

export type AppFontSize = 'normal' | 'large' | 'xlarge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontSize: AppFontSize;
  onFontSizeChange: (size: AppFontSize) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  fontSize,
  onFontSizeChange,
}) => {
  if (!isOpen) return null;

  const fontOptions: Array<{
    id: AppFontSize;
    label: string;
    description: string;
    sampleText: string;
    scale: string;
  }> = [
    {
      id: 'normal',
      label: 'استاندارد (معمولی)',
      description: 'اندازه پیش‌فرض برای تمامی دستگاه‌ها',
      sampleText: 'پژو ۲۰۷ مدل ۱۴۰۴ - ۷۵۰ میلیون',
      scale: '۱۰۰٪',
    },
    {
      id: 'large',
      label: 'درشت و خوانا',
      description: 'پیشنهادی برای مطالعه راحت‌تر در گوشی',
      sampleText: 'پژو ۲۰۷ مدل ۱۴۰۴ - ۷۵۰ میلیون',
      scale: '۱۱۵٪',
    },
    {
      id: 'xlarge',
      label: 'خیلی درشت (ویژه افراد مسن)',
      description: 'حداکثر وضوح و سایز خط برای کم‌بینایان',
      sampleText: 'پژو ۲۰۷ مدل ۱۴۰۴ - ۷۵۰ میلیون',
      scale: '۱۳۰٪',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">تنظیمات اندازه نوشته‌ها</h3>
              <p className="text-[11px] text-slate-400 font-medium">
                تغییر سایز فونت برای خوانایی بهتر در گوشی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره تنظیمات"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Font Size Selection Options */}
        <div className="space-y-2.5 my-4">
          {fontOptions.map((opt) => {
            const isSelected = fontSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFontSizeChange(opt.id)}
                className={`w-full p-3.5 rounded-2xl border-2 text-right transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{opt.label}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {opt.scale}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{opt.description}</p>
                  <p
                    className="text-slate-700 font-bold pt-0.5"
                    style={{
                      fontSize: opt.id === 'normal' ? '13px' : opt.id === 'large' ? '15px' : '17px',
                    }}
                  >
                    نمونه: {opt.sampleText}
                  </p>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-3 ${
                    isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Elderly Tip */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            اندازه انتخابی شما ذخیره شده و روی تمامی بخش‌های برنامه و آگهی‌ها اعمال می‌شود.
          </span>
        </div>

        {/* Close confirmation button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-sm rounded-xl cursor-pointer shadow-sm transition-colors"
        >
          تأیید و ذخیره تنظیمات
        </button>
      </div>
    </div>
  );
};
