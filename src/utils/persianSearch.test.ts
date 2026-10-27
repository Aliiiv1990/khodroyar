import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePersianText,
  buildSearchIndex,
  tokenizeSearchQuery,
  matchesSearchTokens,
  filterCarListings,
} from './persianSearch';
import { CarListing, FilterOptions } from '../types/car';

test('normalizePersianText converts Arabic characters to Persian equivalents', () => {
  assert.equal(normalizePersianText('پژو ٢٠٦ تيپ ٥'), 'پژو 206 تیپ 5');
  assert.equal(normalizePersianText('كوييك كراس'), 'کوییک کراس');
  assert.equal(normalizePersianText('پراید ۱۱۱ سفید'), 'پراید 111 سفید');
  assert.equal(normalizePersianText('دنا پلاس اتوماتيك'), 'دنا پلاس اتوماتیک');
  assert.equal(normalizePersianText('بنزين با نيم‌فاصله'), 'بنزین با نیم فاصله');
});

test('normalizePersianText handles diacritics and excessive whitespace', () => {
  assert.equal(normalizePersianText('تِستْ   فَضَاءِ   خَالِی'), 'تست فضاء خالی');
});

test('tokenizeSearchQuery returns normalized search tokens', () => {
  const tokens = tokenizeSearchQuery('پژو  ۲۰۶   سفید');
  assert.deepEqual(tokens, ['پژو', '206', 'سفید']);
});

test('matchesSearchTokens handles order-independent multi-word search', () => {
  const index = 'پژو 206 تیپ 2 سفید 1400 بدون رنگ تهران';
  assert.equal(matchesSearchTokens(index, ['206', 'پژو']), true);
  assert.equal(matchesSearchTokens(index, ['سفید', 'تهران', '206']), true);
  assert.equal(matchesSearchTokens(index, ['پراید']), false);
});

test('filterCarListings filters 5,000 items in sub-50ms', () => {
  // Generate 5,000 mock listings
  const listings: CarListing[] = [];
  const brands = ['پژو', 'سایپا', 'ایران خودرو', 'مدیران خودرو', 'بهمن موتور'];

  for (let i = 0; i < 5000; i++) {
    const is206 = i % 5 === 0;
    const title = is206 ? `پژو ۲۰۶ تیپ ۲ مدل ۱۴۰${i % 4}` : `خودرو آزمایشی ${i}`;
    const listing: CarListing = {
      id: `car-${i}`,
      type: i % 4 === 0 ? 'buy_request' : 'sale',
      title,
      brand: brands[i % brands.length],
      model: is206 ? '۲۰۶' : 'مدل دیگر',
      year: 1400 + (i % 4),
      price: 350_000_000 + (i * 10000) % 500_000_000,
      priceFormatted: '۴۰۰,۰۰۰,۰۰۰ تومان',
      mileage: 45000,
      mileageFormatted: '۴۵,۰۰۰ کیلومتر',
      color: 'سفید',
      gearbox: 'دنده‌ای',
      bodyCondition: 'بی‌رنگ',
      fuelType: 'بنزین',
      city: i % 2 === 0 ? 'تهران' : 'مشهد',
      phoneNumber: '09123456789',
      description: 'بسیار تمیز، مصرفی‌ها تعویض شده',
      createdAt: new Date(Date.now() - (i % 3) * 86400000).toISOString(),
      imageThumbnailBase64: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      imageFullBase64: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    };
    listing._searchIndex = buildSearchIndex(listing);
    listings.push(listing);
  }

  const filters: FilterOptions = {
    type: 'sale',
    searchQuery: 'پژو 206',
    brand: '',
    priceRange: 'all',
    dayFilter: 'all',
    city: '',
  };

  const startTime = performance.now();
  const results = filterCarListings(listings, filters);
  const duration = performance.now() - startTime;

  assert.ok(results.length > 0, 'Should find 206 listings');
  assert.ok(duration < 50, `Filtering 5,000 listings took ${duration.toFixed(2)}ms (should be < 50ms)`);
});
