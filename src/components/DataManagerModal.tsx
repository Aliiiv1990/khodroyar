import React, { useState, useRef } from 'react';
import { CarListing } from '../types/car';
import { pruneOldListings, toPersianDigits, MAX_RETENTION_DAYS } from '../utils/dataPruner';
import { generateRealisticCarListings } from '../utils/dataGenerator';
import { parseZipArchive, parseSessionJson, parseCarCsv, SessionJsonRoot } from '../utils/sessionDataParser';
import { parseSellersJson } from '../utils/sellerDataParser';
import { clearIndexedDBListings, saveListingsToIndexedDB, setStorageExplicitlyCleared } from '../utils/storage';
import { publishAdminDatasetToCloud, fetchAdminDatasetFromCloud } from '../utils/cloudSync';
import {
  X,
  Database,
  UploadCloud,
  Download,
  Trash2,
  Sparkles,
  Check,
  AlertCircle,
  FileCode,
  AlertTriangle,
  Upload,
  Archive,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
} from 'lucide-react';

interface DataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: CarListing[];
  onUpdateListings: (newListings: CarListing[]) => void;
}

// Complete mock session adhering to the Car Exhibition Dataset Specification
const SPEC_SAMPLE_SESSION: SessionJsonRoot = {
  version: 2,
  normalizationRules: [
    {
      id: 'rule-207',
      targetName: 'پژو ۲۰۷ سقف شیشه‌ای',
      aliases: ['207 پانا', '۲۰۷ پانوراما', '207 سقف شیشه'],
    },
    {
      id: 'rule-tara',
      targetName: 'ایران خودرو تارا اتوماتیک V4',
      aliases: ['تارا اتو', 'تارا v4', 'تارا اتومات'],
    },
  ],
  dominantKeywords: ['تیپ 2', 'توربو', 'اتومات', 'پانوراما'],
  sellers: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      rowIndex: 1,
      imageFileName: '989122959582_9584.jpg',
      status: 'success',
      اسم_ماشین: '207 پانا',
      سال_ساخت: '۱۴۰۴',
      رنگ: 'سفید',
      کارکرد_کیلومتر: '۰',
      قیمت_تومان: '۸۴۰,۰۰۰,۰۰۰',
      اسم_فروشنده: '989122959582',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      rowIndex: 2,
      imageFileName: '989122720114_7282.jpg',
      status: 'success',
      اسم_ماشین: 'ایران خودرو تارا',
      سال_ساخت: '1403',
      رنگ: 'مشکی متالیک',
      کارکرد_کیلومتر: '۱۵,۰۰۰',
      قیمت_تومان: '۹۲۰,۰۰۰,۰۰۰',
      اسم_فروشنده: '989122720114',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      rowIndex: 3,
      imageFileName: '989121769442_5144.txt',
      status: 'success',
      اسم_ماشین: 'تویوتا کمری',
      سال_ساخت: '2025',
      رنگ: 'سربی',
      کارکرد_کیلومتر: '۵,۰۰۰',
      قیمت_تومان: '۴,۲۰۰,۰۰۰,۰۰۰',
      اسم_فروشنده: '989121769442',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      rowIndex: 4,
      imageFileName: '989128360320_8568_۸۲_چن_لکه_رنگ.jpg',
      status: 'success',
      اسم_ماشین: 'سیتروئن زانتیا',
      سال_ساخت: '82',
      رنگ: 'نقره‌ای',
      کارکرد_کیلومتر: '۲۲۰,۰۰۰',
      قیمت_تومان: '۳۱۰,۰۰۰,۰۰۰',
      اسم_فروشنده: '989128360320',
    },
  ],
  buyers: [
    {
      id: 'buyer-uuid-8801',
      rowIndex: 1,
      imageFileName: 'ورودی دستی',
      status: 'success',
      اسم_مشتری: '989124383296',
      اسم_ماشین: 'نیسان جوک',
      سال_ساخت: '2017 به بالا',
      رنگ: 'مشکی یا سفید',
      بودجه_تقریبی_تومان: '۱,۶۰۰,۰۰۰,۰۰۰',
      توضیحات_بیشتر: 'خریدار نقدی فوری، بدون رنگ، کارکرد زیر ۸۰ هزار',
    },
    {
      id: 'buyer-uuid-8802',
      rowIndex: 2,
      imageFileName: 'ورودی دستی',
      status: 'success',
      اسم_مشتری: '989121837606',
      اسم_ماشین: 'هیوندای پالیسید',
      سال_ساخت: '2025 یا 2026',
      رنگ: 'مشکی',
      بودجه_تقریبی_تومان: 'توافقی',
      توضیحات_بیشتر: 'تحویل فوری روز، تسویه در صرافی',
    },
  ],
};

export const DataManagerModal: React.FC<DataManagerModalProps> = ({
  isOpen,
  onClose,
  listings,
  onUpdateListings,
}) => {
  const [inputText, setInputText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'import' | 'spec'>('status');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isPublishingCloud, setIsPublishingCloud] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [isFetchingCloud, setIsFetchingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Cloud Publish handler (Admin uploads daily data for all users)
  const handlePublishToCloud = async () => {
    if (listings.length === 0) {
      setImportStatus('ابتدا باید دیتایی وارد سامانه شده باشد تا روی ابر منتشر شود.');
      setIsSuccess(false);
      return;
    }

    setIsPublishingCloud(true);
    setPublishProgress(0);
    setImportStatus('در حال آماده‌سازی و ارسال بسته‌های اطلاعاتی به پایگاه داده ابری (Firestore)...');

    try {
      await publishAdminDatasetToCloud(listings, (percent) => {
        setPublishProgress(percent);
      });
      setImportStatus(
        `بانک اطلاعات روزانه (${toPersianDigits(listings.length)} آگهی) با موفقیت در پایگاه ابری منتشر شد! هم‌اکنون تمامی بازدیدکنندگان و کاربران این داده‌ها را مشاهده می‌کنند.`
      );
      setIsSuccess(true);
    } catch (err: any) {
      setImportStatus(`خطا در انتشار ابری: ${err.message || 'مشکل در برقراری ارتباط'}`);
      setIsSuccess(false);
    } finally {
      setIsPublishingCloud(false);
    }
  };

  // Cloud Fetch handler (Fetch latest admin dataset)
  const handleFetchFromCloud = async () => {
    setIsFetchingCloud(true);
    setImportStatus('در حال بررسی و بارگیری آخرین نسخه بانک اطلاعاتی از فضای ابری...');

    try {
      const cloudData = await fetchAdminDatasetFromCloud((percent) => {
        setPublishProgress(percent);
      });

      if (cloudData && cloudData.length > 0) {
        const { prunedListings } = pruneOldListings(cloudData);
        setStorageExplicitlyCleared(false);
        await saveListingsToIndexedDB(prunedListings);
        onUpdateListings(prunedListings);
        setImportStatus(
          `آخرین نسخه بانک اطلاعات ابری (${toPersianDigits(prunedListings.length)} خودرو) با موفقیت بارگذاری شد.`
        );
        setIsSuccess(true);
      } else {
        setImportStatus('هنوز بانک اطلاعاتی روزانه‌ای توسط ادمین در ابر منتشر نشده است.');
        setIsSuccess(false);
      }
    } catch (err: any) {
      setImportStatus(`خطا در دریافت اطلاعات ابری: ${err.message || 'مشکل اتصال'}`);
      setIsSuccess(false);
    } finally {
      setIsFetchingCloud(false);
    }
  };

  // Clear all listings
  const handleConfirmClearAll = async () => {
    await clearIndexedDBListings();
    setStorageExplicitlyCleared(true);
    onUpdateListings([]);
    setShowClearConfirm(false);
    setImportStatus('تمامی آگهی‌ها با موفقیت پاک شدند (دیتابیس کاملاً خالی شد و در حافظه ماندگار ثبت گردید).');
    setIsSuccess(true);
  };

  const handlePruneNow = async () => {
    const { prunedListings, removedCount } = pruneOldListings(listings);
    await saveListingsToIndexedDB(prunedListings);
    onUpdateListings(prunedListings);
    setImportStatus(
      `پاکسازی خودکار انجام شد: ${toPersianDigits(removedCount)} آگهی قدیمی‌تر از ۴ روز حذف گردید.`
    );
    setIsSuccess(true);
  };

  const handleRegenerate5000 = async () => {
    const fresh = generateRealisticCarListings(5000);
    const { prunedListings } = pruneOldListings(fresh);
    setStorageExplicitlyCleared(false);
    await saveListingsToIndexedDB(prunedListings);
    onUpdateListings(prunedListings);
    setImportStatus(`۵,۰۰۰ آگهی جدید و واقعی با موفقیت در بانک اطلاعاتی مرورگر بارگذاری شد.`);
    setIsSuccess(true);
  };

  const handleLoadSpecSample = () => {
    setInputText(JSON.stringify(SPEC_SAMPLE_SESSION, null, 2));
    setActiveTab('import');
    setImportStatus('نمونه داده استاندارد session.json (شامل فروشندگان و خریداران) در کادر قرار گرفت.');
    setIsSuccess(true);
  };

  // Handles ZIP, JSON or CSV file selection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportStatus(`در حال پردازش فایل ${file.name}...`);

    try {
      const fileNameLower = file.name.toLowerCase();

      // Case A: ZIP archive (car_session_*.zip)
      if (fileNameLower.endsWith('.zip')) {
        const result = await parseZipArchive(file);
        const { prunedListings, removedCount } = pruneOldListings(result.listings);
        setStorageExplicitlyCleared(false);
        await saveListingsToIndexedDB(prunedListings);
        onUpdateListings(prunedListings);

        setImportStatus(
          `آرشیو زیپ با موفقیت باز شد: ${toPersianDigits(result.sellersCount)} خودرو فروشی، ${toPersianDigits(
            result.buyersCount
          )} سفارش خرید، و ${toPersianDigits(result.extractedImagesCount)} تصویر از پوشه data/ استخراج شد. (${toPersianDigits(
            removedCount
          )} مورد قدیمی منقضی شد)`
        );
        setIsSuccess(true);
        setActiveTab('status');
      }
      // Case B: CSV file
      else if (fileNameLower.endsWith('.csv')) {
        const text = await file.text();
        const csvListings = parseCarCsv(text);
        if (csvListings.length === 0) {
          throw new Error('هیچ رکوردی در فایل CSV یافت نشد.');
        }
        const { prunedListings } = pruneOldListings(csvListings);
        setStorageExplicitlyCleared(false);
        await saveListingsToIndexedDB(prunedListings);
        onUpdateListings(prunedListings);

        setImportStatus(`فایل CSV با موفقیت پردازش شد: ${toPersianDigits(csvListings.length)} رکورد وارد سامانه شد.`);
        setIsSuccess(true);
        setActiveTab('status');
      }
      // Case C: JSON file (session.json)
      else {
        const text = await file.text();
        setInputText(text);
        await processJsonText(text, false);
      }
    } catch (err: any) {
      setImportStatus(`خطا در باز کردن فایل: ${err.message || 'فرمت نامعتبر است'}`);
      setIsSuccess(false);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processJsonText = async (rawText: string, append = false) => {
    try {
      if (!rawText.trim()) {
        setImportStatus('لطفاً ابتدا محتوای JSON یا CSV را در کادر زیر وارد کنید.');
        setIsSuccess(false);
        return;
      }

      // Check if CSV
      if (rawText.includes(',') && (rawText.includes('اسم ماشین') || rawText.includes('اسم مشتری'))) {
        const csvListings = parseCarCsv(rawText);
        const merged = append ? [...csvListings, ...listings] : csvListings;
        const { prunedListings } = pruneOldListings(merged);
        setStorageExplicitlyCleared(false);
        await saveListingsToIndexedDB(prunedListings);
        onUpdateListings(prunedListings);
        setImportStatus(`تعداد ${toPersianDigits(csvListings.length)} رکورد از CSV با موفقیت اضافه شد.`);
        setIsSuccess(true);
        setInputText('');
        return;
      }

      const parsed = JSON.parse(rawText);

      // If full session.json with sellers / buyers
      let newListings: CarListing[] = [];
      let message = '';

      if (parsed && typeof parsed === 'object' && (parsed.sellers || parsed.buyers)) {
        const sessionResult = parseSessionJson(parsed);
        newListings = sessionResult.listings;
        message = `تزریق فایل کامل: ${toPersianDigits(sessionResult.sellersCount)} فروشنده و ${toPersianDigits(
          sessionResult.buyersCount
        )} متقاضی خرید وارد شدند.`;
      } else {
        // Fallback to sellerDataParser
        const sellerResult = parseSellersJson(parsed);
        newListings = sellerResult.listings;
        message = `تزریق انجام شد: ${toPersianDigits(newListings.length)} آگهی با موفقیت افزوده شد.`;
      }

      if (newListings.length === 0) {
        throw new Error('هیچ رکورد معتبری در ورودی یافت نشد.');
      }

      const merged = append ? [...newListings, ...listings] : newListings;
      const { prunedListings, removedCount } = pruneOldListings(merged);

      setStorageExplicitlyCleared(false);
      await saveListingsToIndexedDB(prunedListings);
      onUpdateListings(prunedListings);
      setImportStatus(`${message} (${toPersianDigits(removedCount)} مورد منقضی ۴ روز حذف شد)`);
      setIsSuccess(true);
      setInputText('');
    } catch (err: any) {
      setImportStatus(`خطا در پردازش ورودی: ${err.message || 'ساختار نامعتبر است'}`);
      setIsSuccess(false);
    }
  };

  const handleExportJson = () => {
    const exportData: SessionJsonRoot = {
      version: 2,
      sellers: listings
        .filter((l) => l.type === 'sale')
        .map((l, idx) => ({
          id: l.id,
          rowIndex: idx + 1,
          imageFileName: `${l.phoneNumber}_car.jpg`,
          status: 'success',
          اسم_ماشین: l.model,
          سال_ساخت: toPersianDigits(l.year),
          رنگ: l.color,
          کارکرد_کیلومتر: l.mileage,
          قیمت_تومان: l.price,
          اسم_فروشنده: l.phoneNumber,
        })),
      buyers: listings
        .filter((l) => l.type === 'buy_request')
        .map((l, idx) => ({
          id: l.id,
          rowIndex: idx + 1,
          imageFileName: 'ورودی دستی',
          status: 'success',
          اسم_مشتری: l.phoneNumber,
          اسم_ماشین: l.model,
          سال_ساخت: toPersianDigits(l.year),
          رنگ: l.color,
          بودجه_تقریبی_تومان: l.price,
          توضیحات_بیشتر: l.description,
        })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `car_session_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">
                مدیریت داده‌ها و ورودی اکسپورت (ZIP / JSON / CSV)
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                سازگار با ساختار استاندارد car_session_*.zip و session.json
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره مدیریت داده"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 my-3 border-b border-slate-100 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
              activeTab === 'status' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            وضعیت داده‌ها
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
              activeTab === 'import' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            تزریق ZIP / JSON / CSV
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('spec')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
              activeTab === 'spec' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            راهنمای ساختار ورودی
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {importStatus && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {isSuccess ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{importStatus}</span>
            </div>
          )}

          {/* Confirm Clear Modal Box */}
          {showClearConfirm && (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-red-800 font-extrabold text-sm mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <span>آیا مطمئن هستید که می‌خواهید همه آگهی‌ها را پاک کنید؟</span>
              </div>
              <p className="text-xs text-red-700 leading-relaxed mb-4">
                با این کار تمامی {toPersianDigits(listings.length)} آگهی فعلی حذف شده و لیست خالی
                خواهد شد.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
                >
                  بله، همه آگهی‌ها را پاک کن
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs text-slate-400 font-bold block mb-1">
                    کل آگهی‌های فعال
                  </span>
                  <span className="text-xl font-black text-slate-900">
                    {toPersianDigits(listings.length)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs text-slate-400 font-bold block mb-1">
                    پنجره مجاز نگهداری
                  </span>
                  <span className="text-xl font-black text-blue-700">
                    {toPersianDigits(MAX_RETENTION_DAYS)} روز اخیر
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 col-span-2 sm:col-span-1">
                  <span className="text-xs text-slate-400 font-bold block mb-1">وضعیت حافظه رم</span>
                  <span className="text-sm font-black text-emerald-600">
                    سبک و ایمن (Virtualize)
                  </span>
                </div>
              </div>

              {/* Cloud Sync & Distribution Box */}
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/80 border border-blue-200/90 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800">
                        همگام‌سازی ابری و انتشار همگانی (Cloud Sync)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        انتشار داده‌ها به صورت سراسری برای تمامی بازدیدکنندگان و دستگاه‌ها
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    متصل به فایربیس
                  </span>
                </div>

                {isPublishingCloud && (
                  <div className="my-2.5 bg-white p-2.5 rounded-xl border border-blue-200 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-black text-blue-800 mb-1">
                      <span>در حال انتشار اطلاعات روی ابر...</span>
                      <span>{toPersianDigits(publishProgress)}٪</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                        style={{ width: `${publishProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handlePublishToCloud}
                    disabled={isPublishingCloud || isFetchingCloud || listings.length === 0}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition-colors"
                  >
                    {isPublishingCloud ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CloudUpload className="w-4 h-4" />
                    )}
                    <span>انتشار داده‌های فعلی در ابر برای همه</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFetchFromCloud}
                    disabled={isPublishingCloud || isFetchingCloud}
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer shadow-2xs transition-colors"
                  >
                    {isFetchingCloud ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <CloudDownload className="w-4 h-4 text-blue-600" />
                    )}
                    <span>دریافت آخرین نسخه ابری ادمین</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerate5000}
                    className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>تولید ۵,۰۰۰ آگهی آزمایشی</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadSpecSample}
                    className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
                  >
                    <FileCode className="w-4 h-4" />
                    <span>تست ساختار کامل (فروشندگان + خریداران)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePruneNow}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-amber-600" />
                    <span>حذف قدیمی‌تر از ۴ روز</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>خروجی session.json</span>
                  </button>
                </div>

                {/* THE CLEAR ALL BUTTON */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 rounded-xl text-xs font-black transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>پاک کردن همه آگهی‌ها (خالی کردن کامل لیست)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-3">
              {/* File upload box */}
              <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/50 rounded-2xl p-4 text-center transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".zip,.json,.csv,application/zip,application/json,text/csv,text/plain"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Archive className="w-6 h-6" />
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      انتخاب فایل آرشیو ZIP یا فایل‌های JSON / CSV
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      آرشیوهای زیپ شامل پوشه <code className="font-mono text-blue-700">data/</code> به صورت خودکار آنزیپ و عکس‌های هر آگهی متصل می‌شوند.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isProcessing ? 'در حال استخراج...' : 'انتخاب فایل از دستگاه'}</span>
                  </button>
                </div>
              </div>

              {/* Textarea for JSON/CSV paste */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  یا کدهای متنی JSON / CSV را در این کادر جای‌گذاری کنید:
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder='{ "version": 2, "sellers": [...], "buyers": [...] }'
                  rows={6}
                  className="w-full bg-slate-50 p-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 dir-ltr text-left"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => processJsonText(inputText, false)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-xl cursor-pointer shadow-sm"
                >
                  جایگزینی کل داده‌ها با این ورودی
                </button>
                <button
                  type="button"
                  onClick={() => processJsonText(inputText, true)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-black text-xs rounded-xl cursor-pointer shadow-sm"
                >
                  افزودن به داده‌های فعلی
                </button>
              </div>
            </div>
          )}

          {activeTab === 'spec' && (
            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-blue-900 space-y-2">
                <div className="flex items-center gap-1.5 font-black text-sm text-blue-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>پشتیبانی کامل از استاندارد Car Exhibition Dataset Specification:</span>
                </div>
                <p>
                  برنامه به طور خودکار فایل فشرده ZIP را با رعایت نکات زیر پردازش می‌کند:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pr-1">
                  <li>
                    <strong>فایل session.json:</strong> رکوردهای فروشندگان (sellers) و خریداران (buyers) را خوانده و در دو تب تفکیک‌شده قرار می‌دهد.
                  </li>
                  <li>
                    <strong>پوشه data/ در ZIP:</strong> تصاویر با نام فایل معادل <code className="font-mono text-blue-700">id</code> آگهی استخراج شده و به کارت‌ها متصل می‌شوند.
                  </li>
                  <li>
                    <strong>قوانین normalizationRules:</strong> نام‌های مستعار مدل خودروها (مانند «۲۰۷ پانا») طبق جدول قوانین به نام رسمی تغییر می‌یابند.
                  </li>
                  <li>
                    <strong>شماره‌های تماس ۹۸:</strong> به صورت خودکار به پیش‌شماره استاندارد ۰۹ تبدیل شده و با دکمه سبز رنگ «تماس تلفنی مستقیم» لینک می‌شوند.
                  </li>
                  <li>
                    <strong>فایل‌های CSV:</strong> خروجی‌های جدول فروشندگان و خریداران با کدگذاری UTF-8 BOM پشتیبانی می‌شوند.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-2xl text-[11px] font-mono overflow-x-auto dir-ltr text-left">
{`{
  "version": 2,
  "sellers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "imageFileName": "car.jpg",
      "اسم_ماشین": "207",
      "سال_ساخت": "۱۴۰۴",
      "رنگ": "سفید",
      "کارکرد_کیلومتر": "۰",
      "قیمت_تومان": "۸۴۰,۰۰۰,۰۰۰",
      "اسم_فروشنده": "989122959582",
      "status": "success"
    }
  ],
  "buyers": [
    {
      "id": "buyer-uuid-1",
      "اسم_ماشین": "تارا اتوماتیک",
      "سال_ساخت": "1403",
      "بودجه_تقریبی_تومان": "۹۰۰,۰۰۰,۰۰۰",
      "توضیحات_بیشتر": "خریدار فوری، بی‌رنگ",
      "اسم_مشتری": "989121234567",
      "status": "success"
    }
  ]
}`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
