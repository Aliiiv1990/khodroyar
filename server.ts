import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'));

// Generous body limit for car catalog datasets and images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS configuration for local dev and Liara domain
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Database file path resolution (Liara Persistent Disk at /data or local fallback)
function getDbFilePath(): string {
  // 1. Check if Liara Persistent Disk is mounted at /data
  if (fs.existsSync('/data')) {
    return '/data/cars_database.json';
  }
  // 2. Local fallback folder
  const localDir = path.resolve(__dirname, 'data');
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch {
      // ignore
    }
  }
  return path.resolve(localDir, 'cars_database.json');
}

interface DatabasePayload {
  lastUpdated: string;
  publishedBy: string;
  listings: any[];
}

function readDatabase(): DatabasePayload {
  const filePath = getDbFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          lastUpdated: new Date().toISOString(),
          publishedBy: 'سامانه',
          listings: parsed,
        };
      }
      return {
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        publishedBy: parsed.publishedBy || 'مدیر سیستم',
        listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      };
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  return {
    lastUpdated: new Date().toISOString(),
    publishedBy: 'پیش‌فرض',
    listings: [],
  };
}

function writeDatabase(payload: DatabasePayload): void {
  const filePath = getDbFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error('Error writing database file:', err);
    throw err;
  }
}

// 4-day retention pruner for server database
function pruneOldServerListings(listings: any[]) {
  const now = Date.now();
  const maxAgeMs = 4 * 24 * 60 * 60 * 1000;
  return listings.filter((item) => {
    if (!item.createdAt) return true;
    const itemTime = new Date(item.createdAt).getTime();
    if (isNaN(itemTime)) return true;
    return now - itemTime <= maxAgeMs;
  });
}

// -----------------------------------------------------------------------------
// API Endpoints for Liara Cloud Backend
// -----------------------------------------------------------------------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbData = readDatabase();
  res.json({
    status: 'ok',
    platform: 'Liara Cloud (Node.js)',
    dbLocation: getDbFilePath(),
    isLiaraDisk: fs.existsSync('/data'),
    totalListings: dbData.listings.length,
    lastUpdated: dbData.lastUpdated,
    serverTime: new Date().toISOString(),
  });
});

// GET /api/listings: Retrieve listings from Liara database
app.get('/api/listings', (req, res) => {
  try {
    const dbData = readDatabase();
    const activeListings = pruneOldServerListings(dbData.listings);
    res.json({
      success: true,
      lastUpdated: dbData.lastUpdated,
      publishedBy: dbData.publishedBy,
      total: activeListings.length,
      listings: activeListings,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/listings: Add single listing by colleague or user
app.post('/api/listings', (req, res) => {
  try {
    const newListing = req.body;
    if (!newListing || !newListing.model) {
      return res.status(400).json({ success: false, error: 'اطلاعات خودرو ناقص است.' });
    }

    const dbData = readDatabase();
    const existing = dbData.listings.filter((l) => l.id !== newListing.id);
    const updatedListings = [
      {
        ...newListing,
        createdAt: newListing.createdAt || new Date().toISOString(),
        source: newListing.source || 'user',
      },
      ...existing,
    ];

    dbData.listings = pruneOldServerListings(updatedListings);
    dbData.lastUpdated = new Date().toISOString();
    writeDatabase(dbData);

    res.json({
      success: true,
      message: 'آگهی با موفقیت در دیتابیس ابری ثبت گردید.',
      listing: newListing,
      total: dbData.listings.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/sync: Bulk upload/replace daily feed by admin
app.post('/api/admin/sync', (req, res) => {
  try {
    const { listings: incomingListings, append, publishedBy } = req.body;
    if (!Array.isArray(incomingListings)) {
      return res.status(400).json({ success: false, error: 'لیست آگهی‌ها ارسال نشده است.' });
    }

    const dbData = readDatabase();
    let finalList: any[] = [];

    if (append) {
      const existingIds = new Set(incomingListings.map((l) => l.id));
      const filteredExisting = dbData.listings.filter((l) => !existingIds.has(l.id));
      finalList = [...incomingListings, ...filteredExisting];
    } else {
      finalList = incomingListings;
    }

    const pruned = pruneOldServerListings(finalList);
    const newPayload: DatabasePayload = {
      lastUpdated: new Date().toISOString(),
      publishedBy: publishedBy || 'مدیر سیستم',
      listings: pruned,
    };

    writeDatabase(newPayload);

    res.json({
      success: true,
      message: `بانک اطلاعات با موفقیت در سرور و دیتابیس لیارا به روزرسانی شد (${pruned.length} خودرو).`,
      count: pruned.length,
      lastUpdated: newPayload.lastUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/clear: Clear database
app.post('/api/admin/clear', (req, res) => {
  try {
    writeDatabase({
      lastUpdated: new Date().toISOString(),
      publishedBy: 'مدیر سیستم',
      listings: [],
    });
    res.json({ success: true, message: 'دیتابیس لیارا با موفقیت پاکسازی شد.', count: 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export: Direct JSON backup download
app.get('/api/export', (req, res) => {
  const dbData = readDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=liara_cars_backup_${Date.now()}.json`);
  res.send(JSON.stringify(dbData.listings, null, 2));
});

// Helper to recursively add files from a directory to JSZip
function addDirToZip(zipInstance: any, dirPath: string, rootPrefix = '') {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const zipPath = rootPrefix ? `${rootPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirToZip(zipInstance, fullPath, zipPath);
    } else if (entry.isFile()) {
      zipInstance.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

// GET /api/export/liara-zip: Generate complete ready-to-deploy zip for Liara Drag & Drop!
app.get('/api/export/liara-zip', async (req, res) => {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    // 1. Production package.json (minimal dependencies to ensure 5-second deploy in Liara container)
    const prodPackageJson = {
      name: 'car-exhibition',
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        start: 'node server.js',
      },
      dependencies: {
        express: '^4.21.2',
        dotenv: '^17.2.3',
      },
    };
    zip.file('package.json', JSON.stringify(prodPackageJson, null, 2));

    // 2. server.js (compiled standalone server)
    const serverJsPath = path.resolve(__dirname, 'server.js');
    if (fs.existsSync(serverJsPath)) {
      zip.file('server.js', fs.readFileSync(serverJsPath));
    } else {
      const serverTsPath = path.resolve(__dirname, 'server.ts');
      if (fs.existsSync(serverTsPath)) {
        zip.file('server.js', fs.readFileSync(serverTsPath));
      }
    }

    // 3. liara.json
    const liaraJsonContent = {
      platform: 'node',
      app: 'car-exhibition',
      port: 3000,
      disks: [
        {
          name: 'data',
          mountTo: '/data',
        },
      ],
    };
    zip.file('liara.json', JSON.stringify(liaraJsonContent, null, 2));

    // 4. .liaraignore
    zip.file('.liaraignore', 'node_modules/\n.git/\n.env\n.env.local\n.DS_Store\n');

    // 5. .env.example
    zip.file('.env.example', 'PORT=3000\nNODE_ENV=production\n');

    // 6. dist folder (all compiled frontend assets)
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      addDirToZip(zip, distPath, 'dist');
    }

    // 7. README.md
    zip.file(
      'README.md',
      `# Car Exhibition App - آماده برای استقرار در لیارا (Liara Cloud)
این بسته شامل سرور Node.js و فرانت‌اند کامل بیلدشده است.

## نحوه استقرار در ۳ مرحله ساده:
۱. وارد کنسول لیارا (console.liara.ir) شوید و یک برنامه از نوع NodeJS بسازید.
۲. در بخش «دیسک‌ها»، یک دیسک با نام data و مسیر مونت /data ایجاد کنید.
۳. همین فایل زیپ را با Drag & Drop در بخش استقرار رها کنید.
`
    );

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="liara_deployment.zip"');
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error creating Liara zip deployment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Frontend Integration (Vite dev middleware vs Production static serving)
// -----------------------------------------------------------------------------
async function setupFrontend() {
  if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        res.send('پروژه ساخته شده است اما پوشه dist موجود نیست. لطفاً دستور npm run build را اجرا نمایید.');
      });
    }
  } else {
    // Development mode: Vite dev server middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
}

setupFrontend().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(`🚗 Car Exhibition Server is LIVE on Liara Cloud!`);
    console.log(`📍 Listening on: http://0.0.0.0:${PORT}`);
    console.log(`💾 Database file: ${getDbFilePath()}`);
    console.log(`=================================================`);
  });
});
