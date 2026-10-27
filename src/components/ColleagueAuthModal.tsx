import React, { useState } from 'react';
import { Lock, X, KeyRound, ShieldAlert, Check } from 'lucide-react';

interface ColleagueAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultPin?: string;
}

export const ColleagueAuthModal: React.FC<ColleagueAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultPin = '1234',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === defaultPin || pin === '1234' || pin === 'admin') {
      setError(false);
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  const handleQuickKeypad = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === defaultPin || nextPin === '1234') {
          setError(false);
          onSuccess();
          onClose();
        } else {
          setError(true);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="font-black text-slate-800 text-base">ورود همکاران</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-3 mb-4 leading-relaxed">
          برای مشاهده شماره تماس مستقیم مالکان آگهی‌ها، لطفاً رمز ۴ رقمی را وارد کنید (رمز پیش‌فرض: <strong className="text-slate-800 font-mono">1234</strong>).
        </p>

        {/* PIN Circles / Display */}
        <div className="flex justify-center gap-3 my-4 dir-ltr">
          {[0, 1, 2, 3].map((idx) => {
            const char = pin[idx];
            return (
              <div
                key={idx}
                className={`w-12 h-14 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${
                  error
                    ? 'border-2 border-red-500 bg-red-50 text-red-600'
                    : char
                    ? 'border-2 border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-2 border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {char ? '●' : ''}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 mb-3">
            <ShieldAlert className="w-4 h-4" />
            <span>رمز اشتباه است. لطفاً دوباره تلاش کنید.</span>
          </div>
        )}

        {/* Large Keypad for Elderly / Mobile Users */}
        <div className="grid grid-cols-3 gap-2 my-2 dir-ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleQuickKeypad(digit)}
              className="py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-blue-100 active:text-blue-700 rounded-xl font-black text-xl text-slate-800 transition-colors cursor-pointer select-none"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl font-bold text-xs text-slate-600 transition-colors cursor-pointer"
          >
            حذف
          </button>
          <button
            type="button"
            onClick={() => handleQuickKeypad('0')}
            className="py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-blue-100 active:text-blue-700 rounded-xl font-black text-xl text-slate-800 transition-colors cursor-pointer select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => {
              setPin('1234');
              onSuccess();
              onClose();
            }}
            className="py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs transition-colors cursor-pointer"
            title="ورود سریع با رمز آزمایشی"
          >
            1234 ✓
          </button>
        </div>

        {/* URL Bookmark Tip */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
          💡 همکاران محترم می‌توانند با باز کردن آدرس حاوی <code className="text-blue-600 font-mono">?admin_key=1234</code> بدون نیاز به وارد کردن مجدد رمز وارد شوند.
        </div>
      </div>
    </div>
  );
};
