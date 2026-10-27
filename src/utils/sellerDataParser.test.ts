import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSellersJson,
  formatIranianPhone,
  parseCarYear,
  detectBrand,
} from './sellerDataParser';

test('formatIranianPhone converts 989... to 09...', () => {
  assert.equal(formatIranianPhone('989122959582'), '09122959582');
  assert.equal(formatIranianPhone('989121769442'), '09121769442');
  assert.equal(formatIranianPhone('09123456789'), '09123456789');
  assert.equal(formatIranianPhone('9123456789'), '09123456789');
});

test('parseCarYear normalizes Persian, 2-digit and AD years', () => {
  assert.equal(parseCarYear('۱۴۰۴'), 1404);
  assert.equal(parseCarYear('1403'), 1403);
  assert.equal(parseCarYear('82'), 1382);
  assert.equal(parseCarYear('1396'), 1396);
  assert.equal(parseCarYear('2025'), 2025);
  assert.equal(parseCarYear(''), 1402);
});

test('detectBrand recognizes Iranian and imported car brands', () => {
  assert.equal(detectBrand('207'), 'ایران خودرو');
  assert.equal(detectBrand('ایرانخودرو تارا'), 'ایران خودرو');
  assert.equal(detectBrand('تویوتا کمری'), 'تویوتا');
  assert.equal(detectBrand('سیتروئن زانتیا'), 'سیتروئن');
  assert.equal(detectBrand('نیسان جوک'), 'نیسان');
  assert.equal(detectBrand('امویام تیگو 7'), 'مدیران خودرو');
  assert.equal(detectBrand('هیوندای پالیسید'), 'هیوندای');
});

test('parseSellersJson parses user exact JSON format properly', () => {
  const samplePayload = {
    version: 2,
    sellers: [
      {
        id: 'error-row',
        rowIndex: 1,
        imageFileName: '989126359410_9187.jpg',
        status: 'error',
        اسم_فروشنده: '989126359410',
        errorMessage: 'Failed to load image',
      },
      {
        id: 'item-2',
        rowIndex: 2,
        imageFileName: '989122959582_9584.jpg',
        status: 'success',
        اسم_ماشین: '207',
        سال_ساخت: '۱۴۰۴',
        رنگ: '',
        اسم_فروشنده: '989122959582',
      },
      {
        id: 'item-7',
        rowIndex: 7,
        imageFileName: '989121769442_1268_۲۰۷_پانا_۴۰۳_سفید_۴۰_تا_کار._اتومات.jpg',
        status: 'success',
        اسم_ماشین: '207',
        سال_ساخت: '1403',
        رنگ: '۲۰۷ پانا ۴۰۳ سفید ۴۰ تا کار. اتومات',
        اسم_فروشنده: '989121769442',
      },
      {
        id: 'item-9',
        rowIndex: 9,
        imageFileName: '989128360320_8568_۸۲_چن_لکه_رنگ_بدون_ضعف_فنی_عالی.jpg',
        status: 'success',
        اسم_ماشین: 'سیتروئن زانتیا',
        سال_ساخت: '82',
        رنگ: '۸۲ چن لکه رنگ بدون ضعف فنی عالی',
        اسم_فروشنده: '989128360320',
      },
    ],
  };

  const { listings, errorsCount } = parseSellersJson(samplePayload);

  assert.equal(errorsCount, 1);
  assert.equal(listings.length, 3);

  // Check item 2
  assert.equal(listings[0].model, '207');
  assert.equal(listings[0].year, 1404);
  assert.equal(listings[0].phoneNumber, '09122959582');

  // Check item 7 (with details extracted from filename/color text)
  assert.equal(listings[1].phoneNumber, '09121769442');
  assert.equal(listings[1].gearbox, 'اتوماتیک');
  assert.equal(listings[1].color, 'سفید');
  assert.equal(listings[1].mileage, 40000);

  // Check item 9 (Xantia year 82 -> 1382)
  assert.equal(listings[2].model, 'سیتروئن زانتیا');
  assert.equal(listings[2].year, 1382);
  assert.equal(listings[2].phoneNumber, '09128360320');
  assert.equal(listings[2].bodyCondition, 'چند لکه رنگ جزئی، فنی سالم');
});
