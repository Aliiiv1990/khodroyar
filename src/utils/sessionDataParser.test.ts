import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  parseNumericValue,
  applyNormalizationRules,
  parseSessionJson,
  parseZipArchive,
  parseCarCsv,
  SessionJsonRoot,
} from './sessionDataParser';

test('parseNumericValue parses Persian digits, words and commas', () => {
  assert.equal(parseNumericValue('۴۵۰,۰۰۰,۰۰۰'), 450_000_000);
  assert.equal(parseNumericValue('۶۵۰ میلیون'), 650_000_000);
  assert.equal(parseNumericValue('1.2 میلیارد'), 1_200_000_000);
  assert.equal(parseNumericValue('توافقی'), 0);
  assert.equal(parseNumericValue(850000000), 850_000_000);
});

test('applyNormalizationRules maps aliases to targetName', () => {
  const rules = [
    {
      id: 'rule-1',
      targetName: 'پژو ۲۰۷ پانوراما',
      aliases: ['207 پانا', '۲۰۷ سقف شیشه‌ای', '207 pcb'],
    },
    {
      id: 'rule-2',
      targetName: 'دنا پلاس توربو اتوماتیک',
      aliases: ['دنا اتومات', 'دنا توربو اتو'],
    },
  ];

  assert.equal(applyNormalizationRules('207 پانا سفید', rules), 'پژو ۲۰۷ پانوراما');
  assert.equal(applyNormalizationRules('دنا اتومات', rules), 'دنا پلاس توربو اتوماتیک');
  assert.equal(applyNormalizationRules('پراید ۱۱۱', rules), 'پراید ۱۱۱');
});

test('parseSessionJson parses both sellers and buyers correctly', () => {
  const sessionData: SessionJsonRoot = {
    version: 2,
    normalizationRules: [
      {
        id: 'r1',
        targetName: 'پژو ۲۰۷ پانوراما',
        aliases: ['207 پانا'],
      },
    ],
    sellers: [
      {
        id: 'seller-uuid-1',
        rowIndex: 1,
        imageFileName: 'car1.jpg',
        status: 'success',
        اسم_ماشین: '207 پانا',
        سال_ساخت: '۱۴۰۳',
        رنگ: 'سفید',
        کارکرد_کیلومتر: '۲۵,۰۰۰',
        قیمت_تومان: '۷۵۰,۰۰۰,۰۰۰',
        اسم_فروشنده: '989121234567',
      },
      {
        id: 'seller-err-2',
        status: 'error',
        errorMessage: 'File corrupt',
      },
    ],
    buyers: [
      {
        id: 'buyer-uuid-1',
        rowIndex: 1,
        imageFileName: 'ورودی دستی',
        status: 'success',
        اسم_مشتری: '989129876543',
        اسم_ماشین: 'تارا اتوماتیک',
        سال_ساخت: '۱۴۰۲ به بالا',
        رنگ: 'سفید یا مشکی',
        بودجه_تقریبی_تومان: '۹۰۰ میلیون',
        توضیحات_بیشتر: 'خریدار فوری، شاسی‌ها پلمپ باشد',
      },
    ],
  };

  const { listings, sellersCount, buyersCount, errorsCount } = parseSessionJson(sessionData);

  assert.equal(errorsCount, 1);
  assert.equal(sellersCount, 1);
  assert.equal(buyersCount, 1);
  assert.equal(listings.length, 2);

  // Seller check
  const sellerListing = listings.find((l) => l.type === 'sale')!;
  assert.equal(sellerListing.model, 'پژو ۲۰۷ پانوراما');
  assert.equal(sellerListing.year, 1403);
  assert.equal(sellerListing.phoneNumber, '09121234567');
  assert.equal(sellerListing.price, 750_000_000);
  assert.equal(sellerListing.mileage, 25_000);

  // Buyer check
  const buyerListing = listings.find((l) => l.type === 'buy_request')!;
  assert.equal(buyerListing.model, 'تارا اتوماتیک');
  assert.equal(buyerListing.phoneNumber, '09129876543');
  assert.equal(buyerListing.price, 900_000_000);
  assert.ok(buyerListing.description.includes('خریدار فوری'));
});

test('parseZipArchive extracts session.json and maps data/{id} images', async () => {
  const zip = new JSZip();

  const sessionJson = {
    version: 2,
    sellers: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'success',
        اسم_ماشین: 'پژو پارس',
        سال_ساخت: '1401',
        اسم_فروشنده: '989123334455',
        قیمت_تومان: '۶۰۰,۰۰۰,۰۰۰',
      },
    ],
  };

  zip.file('session.json', JSON.stringify(sessionJson));
  // Add a fake jpeg in data/{id}
  zip.file('data/550e8400-e29b-41d4-a716-446655440000', 'fake-image-bytes');

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
  const result = await parseZipArchive(zipBuffer);

  assert.equal(result.sellersCount, 1);
  assert.equal(result.listings.length, 1);
  assert.equal(result.extractedImagesCount, 1);
  assert.ok(result.listings[0].imageFullBase64.startsWith('data:image/jpeg;base64,'));
});

test('parseCarCsv handles sellers and buyers CSV', () => {
  const sellersCsv = `\uFEFFردیف, اسم ماشین, سال ساخت, رنگ, کارکرد (کیلومتر), قیمت (تومان), اسم فروشنده, نام فایل/منبع
1, دنا پلاس, 1402, مشکی, 30000, 800000000, 989124445566, d1.jpg`;

  const buyersCsv = `\uFEFFاسم مشتری, اسم ماشین, سال ساخت, رنگ, بودجه تقریبی (تومان), توضیحات بیشتر, وضعیت, نام فایل تصویر/منبع
989127778899, کوییک S, 1401, سفید, 380000000, مصرف کننده واقعی, success, b1.jpg`;

  const sellers = parseCarCsv(sellersCsv);
  assert.equal(sellers.length, 1);
  assert.equal(sellers[0].type, 'sale');
  assert.equal(sellers[0].model, 'دنا پلاس');
  assert.equal(sellers[0].phoneNumber, '09124445566');

  const buyers = parseCarCsv(buyersCsv);
  assert.equal(buyers.length, 1);
  assert.equal(buyers[0].type, 'buy_request');
  assert.equal(buyers[0].model, 'کوییک S');
  assert.equal(buyers[0].phoneNumber, '09127778899');
});
