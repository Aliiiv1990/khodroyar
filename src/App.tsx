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
import { fetchListingsFromLiara, addListingToLiara } from './utils/liaraApi';

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

    // Step 3: Gentle background polling every 25 seconds so other phones update automatically
    const pollInterval = setInterval(() => {
      if (!isMounted) return;
      fetchListingsFromLiara(6000)
        .then((serverCars) => {
          if (serverCars && serverCars.length > 0 && isMounted) {
            setListings((current) => {
              // Update if count or latest item changed
              if (current.length !== serverCars.length || current[0]?.id !== serverCars[0]?.id) {
                saveListingsToIndexedDB(serverCars);
                return serverCars;
              }
              return current;
            });
          }
        })
        .catch(() => {});
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  // Handle adding new listing from voice or manual entry
  const handleAddNewListing = useCallback((newListing: CarListing) => {
    setStorageExplicitlyCleared(false);

    // 1. Optimistic local update
    setListings((prev) => {
      const updated = [newListing, ...prev.filter((item) => item.id !== newListing.id)];
      saveListingsToIndexedDB(updated);
      return updated;
    });

    // 2. Push to Liara Server & Database (if running on Liara)
    addListingToLiara(newListing).catch((err) => {
      console.warn('Could not sync new ad to Liara server:', err);
    });

    // 3. Push to Firestore so all users across devices receive it
    addListingToCloud(newListing).catch((err) => {
      console.warn('Could not sync new ad to cloud:', err);
    });

    // Switch active tab to match the new listing type
    setFilters((prev) => ({
      ...prev,
      type: newListing.type,
      searchQuery: '',
    }));
  }, []);

  // Compute sale and buy request counts
  const { saleCount, buyCount } = useMemo(() => {
    let sales = 0;
    let buys = 0;
    const len = listings.length;
    for (let i = 0; i < len; i++) {
      if (listings[i].type === 'sale') sales++;
      else buys++;
    }
    return { saleCount: sales, buyCount: buys };
  }, [listings]);

  // Fast filtered listings (< 5ms benchmark for 5,000 items)
  const filteredListings = useMemo(() => {
    return filterCarListings(listings, filters);
  }, [listings, filters]);

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
