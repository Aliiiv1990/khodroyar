/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CarListing, CarListingType, FilterOptions } from './types/car';
import { generateRealisticCarListings } from './utils/dataGenerator';
import { filterCarListings, buildSearchIndex } from './utils/persianSearch';
import { pruneOldListings } from './utils/dataPruner';
import {
  loadListingsFromIndexedDB,
  saveListingsToIndexedDB,
  clearIndexedDBListings,
  isStorageExplicitlyCleared,
  setStorageExplicitlyCleared,
  hasUserVisitedBefore,
  markUserVisited,
} from './utils/storage';
import { HeaderAndTabs } from './components/HeaderAndTabs';
import { SearchBarAndFilters } from './components/SearchBarAndFilters';
import { VirtualCarList } from './components/VirtualCarList';
import { CarDetailModal } from './components/CarDetailModal';
import { ColleagueAuthModal, UserAuthRole } from './components/ColleagueAuthModal';
import { DataManagerModal } from './components/DataManagerModal';
import { SettingsModal, AppFontSize } from './components/SettingsModal';
import { NewListingModal } from './components/NewListingModal';
import {
  subscribeToUserListings,
  addListingToCloud,
  fetchAdminDatasetFromCloud,
} from './utils/cloudSync';
import { fetchListingsFromLiara, addListingToLiara, fetchSyncMetaFromLiara } from './utils/liaraApi';

const DEFAULT_FILTERS: FilterOptions = {
  type: 'sale',
  searchQuery: '',
  brand: '',
  priceRange: 'all',
  dayFilter: 'all',
  city: '',
};

export default function App() {
  // Load listings with persistence: if user cleared the data, keep it empty!
  const [listings, setListings] = useState<CarListing[]>(() => {
    if (typeof window !== 'undefined' && isStorageExplicitlyCleared()) {
      return [];
    }
    // If first-time visitor ever, provide the initial 5,000 demo listings
    if (typeof window !== 'undefined' && !hasUserVisitedBefore()) {
      const raw = generateRealisticCarListings(5000);
      const { prunedListings } = pruneOldListings(raw);
      markUserVisited();
      saveListingsToIndexedDB(prunedListings);
      return prunedListings;
    }
    return [];
  });

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);

  // Selected listing for Bottom Sheet / Modal
  const [selectedListing, setSelectedListing] = useState<CarListing | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Font size setting state (normal, large, xlarge)
  const [fontSize, setFontSize] = useState<AppFontSize>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('car_app_font_size') as AppFontSize;
      if (saved === 'normal' || saved === 'large' || saved === 'xlarge') {
        return saved;
      }
    }
    return 'normal';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply root font-size dynamically
  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === 'large') {
      root.style.fontSize = '18px';
    } else if (fontSize === 'xlarge') {
      root.style.fontSize = '20px';
    } else {
      root.style.fontSize = '16px';
    }
    localStorage.setItem('car_app_font_size', fontSize);
  }, [fontSize]);

  const handleFontSizeChange = useCallback((newSize: AppFontSize) => {
    setFontSize(newSize);
  }, []);

  // Roles: 'guest' (hidden phones), 'colleague' (visible phones), 'admin' (server sync & database controls)
  const [userRole, setUserRole] = useState<UserAuthRole>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const adminKey = params.get('admin') || params.get('admin_key') || params.get('token');
      if (adminKey === '8888' || adminKey === 'admin') {
        localStorage.setItem('car_user_role', 'admin');
        localStorage.setItem('car_colleague_unlocked', 'true');
        return 'admin';
      }
      const colleagueKey = params.get('colleague') || params.get('staff');
      if (colleagueKey === '1234' || adminKey === '1234') {
        localStorage.setItem('car_user_role', 'colleague');
        localStorage.setItem('car_colleague_unlocked', 'true');
        return 'colleague';
      }
      const savedRole = localStorage.getItem('car_user_role') as UserAuthRole;
      if (savedRole === 'admin' || savedRole === 'colleague') {
        return savedRole;
      }
      if (localStorage.getItem('car_colleague_unlocked') === 'true') {
        return 'colleague';
      }
    }
    return 'guest';
  });

  const isUnlockedColleague = userRole === 'admin' || userRole === 'colleague';

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDataManagerOpen, setIsDataManagerOpen] = useState(false);
  const [isNewListingOpen, setIsNewListingOpen] = useState(false);

  // Handle URL token check on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adminKey = params.get('admin') || params.get('admin_key') || params.get('token');
    if (adminKey === '8888' || adminKey === 'admin') {
      setUserRole('admin');
      localStorage.setItem('car_user_role', 'admin');
      localStorage.setItem('car_colleague_unlocked', 'true');
    } else if (adminKey === '1234') {
      setUserRole('colleague');
      localStorage.setItem('car_user_role', 'colleague');
      localStorage.setItem('car_colleague_unlocked', 'true');
    }
  }, []);

  const handleUnlockSuccess = useCallback((role: 'colleague' | 'admin') => {
    setUserRole(role);
    localStorage.setItem('car_user_role', role);
    localStorage.setItem('car_colleague_unlocked', 'true');
    if (role === 'admin') {
      setIsDataManagerOpen(true);
    }
  }, []);

  const handleToggleColleagueLock = useCallback(() => {
    if (userRole !== 'guest') {
      setUserRole('guest');
      localStorage.removeItem('car_user_role');
      localStorage.removeItem('car_colleague_unlocked');
    } else {
      setIsAuthModalOpen(true);
    }
  }, [userRole]);

  // Centralized Data Loader:
  // 1. Immediately renders local cache so UI is instantaneous.
  // 2. Immediately fetches from Liara Server (/api/listings) so EVERY device/phone receives the admin's database.
  // 3. Polls Liara Server every 25 seconds so all open screens stay continuously synchronized.
  useEffect(() => {
    let isMounted = true;
    let lastSeenServerTimestamp = '';

    // Step 1: Render local cache immediately
    if (!isStorageExplicitlyCleared()) {
      loadListingsFromIndexedDB()
        .then((cached) => {
          if (!isMounted) return;
          if (cached && cached.length > 0) {
            const { prunedListings } = pruneOldListings(cached);
            setListings(prunedListings);
          }
        })
        .catch(() => {});
    }

    // Step 2: Fetch the centralized Liara Server Database (Single Source of Truth)
    const syncWithLiara = async () => {
      try {
        const liaraListings = await fetchListingsFromLiara(8000);
        if (liaraListings && liaraListings.length > 0 && isMounted) {
          const { prunedListings } = pruneOldListings(liaraListings);
          setListings(prunedListings);
          setStorageExplicitlyCleared(false);
          markUserVisited();
          await saveListingsToIndexedDB(prunedListings);
          return true;
        }
      } catch (err) {
        console.warn('Could not sync with Liara server:', err);
      }
      return false;
    };

    syncWithLiara().then((synced) => {
      if (!synced && isMounted && !hasUserVisitedBefore() && !isStorageExplicitlyCleared()) {
        const raw = generateRealisticCarListings(5000);
        const { prunedListings } = pruneOldListings(raw);
        setListings(prunedListings);
        markUserVisited();
        saveListingsToIndexedDB(prunedListings);
      }
    });

    // Step 3: Real-time Live Synchronization across Mobile & Laptop (SSE)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/live-sync');
      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data && data.lastUpdated) {
            lastSeenServerTimestamp = data.lastUpdated;
          }
          if (data && Array.isArray(data.hiddenBatches)) {
            const serverHidden = new Set<string>(data.hiddenBatches);
            setHiddenBatches(serverHidden);
            localStorage.setItem('car_hidden_batches', JSON.stringify(data.hiddenBatches));
            window.dispatchEvent(new CustomEvent('car_batches_updated', { detail: data }));
          }

          // If a new bulk sync, clear, batch delete or ad addition occurred from another device
          if (
            data &&
            (data.type === 'bulk_sync' ||
              data.type === 'clear' ||
              data.type === 'batch_deleted' ||
              data.type === 'listing_added')
          ) {
            safeFetchServerData();
          }
        } catch {
          // ignore keep-alive or non-json messages
        }
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect:', e);
    }

    // Mutex flag to prevent simultaneous race conditions when writing to IndexedDB
    let isFetchingServer = false;

    const safeFetchServerData = async () => {
      if (isFetchingServer || !isMounted) return;
      if (typeof window !== 'undefined' && (window as any).__isSyncingToLiara) return;
      isFetchingServer = true;
      try {
        const cars = await fetchListingsFromLiara(8000);
        if (cars && isMounted) {
          const { prunedListings } = pruneOldListings(cars);
          setListings(prunedListings);
          await saveListingsToIndexedDB(prunedListings);
        }
      } catch (err) {
        console.warn('Could not sync with Liara server:', err);
      } finally {
        isFetchingServer = false;
      }
    };

    // Lightweight metadata checker (~50 bytes)
    const checkSyncMeta = async () => {
      if (!isMounted) return;
      if (typeof window !== 'undefined' && (window as any).__isSyncingToLiara) return;

      try {
        const meta = await fetchSyncMetaFromLiara();
        if (!meta || !isMounted) return;

        // Check if batch visibility changed on another phone or laptop
        if (Array.isArray(meta.hiddenBatches)) {
          setHiddenBatches((curr) => {
            const incomingArr = meta.hiddenBatches.slice().sort();
            const currArr = Array.from(curr).sort();
            if (JSON.stringify(incomingArr) !== JSON.stringify(currArr)) {
              localStorage.setItem('car_hidden_batches', JSON.stringify(meta.hiddenBatches));
              window.dispatchEvent(new CustomEvent('car_batches_updated', { detail: meta }));
              return new Set(meta.hiddenBatches);
            }
            return curr;
          });
        }

        // Check if database updated (e.g. ad added or bulk sync on another device)
        if (meta.lastUpdated && meta.lastUpdated !== lastSeenServerTimestamp) {
          lastSeenServerTimestamp = meta.lastUpdated;
          await safeFetchServerData();
        }
      } catch {
        // quiet network failure
      }
    };

    // Step 4: Ultra-lightweight fallback polling to /api/sync-meta (~50 bytes)
    // Runs every 3.5s when active tab, and slows down when tab is hidden to save battery
    let pollInterval: NodeJS.Timeout | null = null;
    const startPolling = (ms: number) => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        checkSyncMeta();
      }, ms);
    };

    startPolling(3500);

    // Visibility-Aware Background Sync:
    // When returning to tab or unlocking mobile phone, immediately refresh data in 1ms!
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        checkSyncMeta();
        startPolling(3500);
      } else {
        // Reduce polling frequency in background to save battery and memory
        startPolling(30000);
      }
    };

    // Online Event: when internet connection reconnects, immediately check server
    const handleOnline = () => {
      checkSyncMeta();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, []);

  // Handle adding new listing from voice or manual entry
  const handleAddNewListing = useCallback((newListing: CarListing) => {
    setStorageExplicitlyCleared(false);

    const taggedListing: CarListing = {
      ...newListing,
      importBatchName: newListing.importBatchName || 'ثبت‌های دستی همکاران و مدیر',
      importDate: newListing.importDate || new Date().toLocaleDateString('fa-IR'),
    };

    // 1. Optimistic local update
    setListings((prev) => {
      const updated = [taggedListing, ...prev.filter((item) => item.id !== taggedListing.id)];
      saveListingsToIndexedDB(updated);
      return updated;
    });

    // 2. Push to Liara Server & Database (if running on Liara)
    addListingToLiara(taggedListing).catch((err) => {
      console.warn('Could not sync new ad to Liara server:', err);
    });

    // 3. Push to Firestore only if NOT on Liara
    if (typeof window !== 'undefined' && !window.location.hostname.includes('liara.run') && !window.location.hostname.includes('liara.ir')) {
      addListingToCloud(newListing).catch((err) => {
        console.warn('Could not sync new ad to cloud:', err);
      });
    }

    // Switch active tab to match the new listing type
    setFilters((prev) => ({
      ...prev,
      type: newListing.type,
      searchQuery: '',
    }));
  }, []);

  // Hidden batches state
  const [hiddenBatches, setHiddenBatches] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('car_hidden_batches');
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set();
  });

  // Listen for storage events when DataManagerModal toggles batch visibility
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem('car_hidden_batches');
        setHiddenBatches(raw ? new Set(JSON.parse(raw)) : new Set());
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Active listings that are not hidden by the admin
  const visibleListings = useMemo(() => {
    if (hiddenBatches.size === 0) return listings;
    return listings.filter((l) => !hiddenBatches.has(l.importBatchName || 'ثبت‌های دستی همکاران و مدیر'));
  }, [listings, hiddenBatches]);

  // Compute sale and buy request counts from visible listings
  const { saleCount, buyCount } = useMemo(() => {
    let sales = 0;
    let buys = 0;
    const len = visibleListings.length;
    for (let i = 0; i < len; i++) {
      if (visibleListings[i].type === 'sale') sales++;
      else buys++;
    }
    return { saleCount: sales, buyCount: buys };
  }, [visibleListings]);

  // Fast filtered listings (< 5ms benchmark for 5,000 items)
  const filteredListings = useMemo(() => {
    return filterCarListings(visibleListings, filters);
  }, [visibleListings, filters]);

  const handleTypeChange = useCallback((type: CarListingType) => {
    setFilters((prev) => ({ ...prev, type }));
  }, []);

  const handleOpenDetails = useCallback((listing: CarListing) => {
    setSelectedListing(listing);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      type: prev.type,
    }));
  }, []);

  const handleUpdateListings = useCallback((newListings: CarListing[]) => {
    setListings(newListings);
    if (newListings.length === 0) {
      clearIndexedDBListings();
      setStorageExplicitlyCleared(true);
    } else {
      setStorageExplicitlyCleared(false);
      saveListingsToIndexedDB(newListings);
    }
  }, []);

  // Incremental append: adds new files/batches without rewriting or wiping existing listings
  const handleAppendListings = useCallback((incomingListings: CarListing[]) => {
    if (!incomingListings || incomingListings.length === 0) return;
    setStorageExplicitlyCleared(false);
    setListings((prev) => {
      const incomingIds = new Set(incomingListings.map((l) => l.id));
      const preserved = prev.filter((p) => !incomingIds.has(p.id));
      const merged = [...incomingListings, ...preserved];
      saveListingsToIndexedDB(merged);
      return merged;
    });
  }, []);

  const handleRegenerateDemo = useCallback(async () => {
    const raw = generateRealisticCarListings(5000);
    const { prunedListings } = pruneOldListings(raw);
    setStorageExplicitlyCleared(false);
    await saveListingsToIndexedDB(prunedListings);
    setListings(prunedListings);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-4xl mx-auto px-2.5 sm:px-4 text-slate-900 select-none">
      {/* Top Header & Main Sale/Buy Tabs */}
      <HeaderAndTabs
        activeType={filters.type}
        onTypeChange={handleTypeChange}
        saleCount={saleCount}
        buyCount={buyCount}
        isUnlockedColleague={isUnlockedColleague}
        userRole={userRole}
        onRequestColleagueModal={() => setIsAuthModalOpen(true)}
        onToggleColleagueLock={handleToggleColleagueLock}
        onOpenDataManager={() => {
          if (userRole === 'admin') {
            setIsDataManagerOpen(true);
          } else {
            setIsAuthModalOpen(true);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewListing={() => setIsNewListingOpen(true)}
      />

      {/* Sticky Search Bar and Quick Chips */}
      <SearchBarAndFilters
        filters={filters}
        onFilterChange={setFilters}
        totalMatches={filteredListings.length}
      />

      {/* Virtualized List Container (only 10-15 cards in DOM at any instant) */}
      <main className="flex-1 flex flex-col min-h-0 pt-2" role="main">
        <VirtualCarList
          listings={filteredListings}
          totalListingsCount={listings.length}
          isUnlockedColleague={isUnlockedColleague}
          onOpenDetails={handleOpenDetails}
          onRequestUnlock={() => setIsAuthModalOpen(true)}
          onResetFilters={handleResetFilters}
          onOpenDataManager={() => setIsDataManagerOpen(true)}
          onRegenerateDemo={handleRegenerateDemo}
          onOpenNewListing={() => setIsNewListingOpen(true)}
        />
      </main>

      {/* Detail Bottom Sheet / Full-Screen Modal with Transparent Glass Overlay */}
      <CarDetailModal
        listing={selectedListing}
        isOpen={isDetailOpen}
        onClose={handleCloseDetails}
        isUnlockedColleague={isUnlockedColleague}
        onRequestUnlock={() => {
          setIsDetailOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      {/* New Car Ad Registration (Voice or Manual) Modal */}
      <NewListingModal
        isOpen={isNewListingOpen}
        onClose={() => setIsNewListingOpen(false)}
        onAddListing={handleAddNewListing}
        defaultType={filters.type}
      />

      {/* Colleague PIN Authentication Modal */}
      <ColleagueAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleUnlockSuccess}
      />

      {/* Data Manager & 4-Day Auto Prune Modal */}
      <DataManagerModal
        isOpen={isDataManagerOpen}
        onClose={() => setIsDataManagerOpen(false)}
        listings={listings}
        onUpdateListings={handleUpdateListings}
        onAppendListings={handleAppendListings}
      />

      {/* App Font Size & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
      />
    </div>
  );
}
