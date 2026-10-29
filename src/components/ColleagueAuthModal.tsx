import React, { useState } from 'react';
import { Lock, X, KeyRound, ShieldAlert, Check, ShieldCheck, Crown } from 'lucide-react';

export type UserAuthRole = 'guest' | 'colleague' | 'admin';

interface ColleagueAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: 'colleague' | 'admin') => void;
  defaultColleaguePin?: string;
  defaultAdminPin?: string;
  promptMessage?: string;
}

export const ColleagueAuthModal: React.FC<ColleagueAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultColleaguePin = '1234',
  defaultAdminPin = '8888',
  promptMessage,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const evaluatePin = (candidate: string) => {
    if (candidate === defaultAdminPin || candidate === '8888' || candidate.toLowerCase() === 'admin') {
      setError(false);
      onSuccess('admin');
      onClose();
      return true;
    }
    if (candidate === defaultColleaguePin || candidate === '1234') {
      setError(false);
      onSuccess('colleague');
      onClose();
      return true;
    }
    return false;
  };

  const handleQuickKeypad = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        if (!evaluatePin(nextPin)) {
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
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="font-black text-slate-800 text-base">ورود همکاران و مدیر نمایشگاه</h3>
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

        <p className="text-xs text-slate-600 mt-3 mb-2 leading-relaxed">
          {promptMessage || 'لطفاً رمز ۴ رقمی دسترسی خود را وارد نمایید:'}
        </p>

        {/* Roles hint badge box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-3 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-bold text-amber-700">
              <Crown className="w-3.5 h-3.5" />
              <span>رمز مدیر کل (انتشار سرور و دیتابیس):</span>
            </span>
            <code className="font-mono font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">۸۸۸۸</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-bold text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>رمز همکار (مشاهده شماره تماس‌ها):</span>
            </span>
            <code className="font-mono font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">۱۲۳۴</code>
          </div>
        </div>

        {/* PIN Circles / Display */}
        <div className="flex justify-center gap-3 my-3 dir-ltr">
          {[0, 1, 2, 3].map((idx) => {
            const char = pin[idx];
            return (
              <div
                key={idx}
                className={`w-12 h-14 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${
                  error
                    ? 'border-2 border-red-500 bg-red-50 text-red-600'
                    : char
                    ? 'border-2 border-purple-600 bg-purple-50 text-purple-700'
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
            <span>رمز واردشده نادرست است. (مدیر: ۸۸۸۸ | همکار: ۱۲۳۴)</span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 my-2 dir-ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleQuickKeypad(digit)}
              className="py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-purple-100 active:text-purple-700 rounded-xl font-black text-xl text-slate-800 transition-colors cursor-pointer select-none"
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
            className="py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-purple-100 active:text-purple-700 rounded-xl font-black text-xl text-slate-800 transition-colors cursor-pointer select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => {
              setPin('8888');
              onSuccess('admin');
              onClose();
            }}
            className="py-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-black text-xs transition-colors cursor-pointer"
            title="ورود به عنوان مدیر"
          >
            👑 مدیر ۸۸۸۸
          </button>
        </div>

        {/* URL Bookmark Tip */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
          💡 لینک مستقیم: با افزودن <code className="text-amber-700 font-mono">?admin=8888</code> یا <code className="text-blue-600 font-mono">?colleague=1234</code> به آدرس سایت، مستقیماً وارد می‌شوید.
        </div>
      </div>
    </div>
  );
};
