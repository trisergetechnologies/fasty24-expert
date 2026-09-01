import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal } from 'react-native';
import { router } from 'expo-router';
import { getPendingOffers, respondToOffer, type Offer } from './api';
import { normalizeOffer, normalizeOffers } from './booking';
import { connectSocket, onOffer } from './socket';
import { getToken } from './storage';
import { startJobBuzzer, stopJobBuzzer } from './jobAlert';
import { bindOfferBridge, bindResumeOffers } from './offerBridge';
import { dismissJobOfferNotification, presentJobOfferNotification } from './push';
import { getPresenceMode, markOnJob } from './presence';
import OfferCard from '../components/OfferCard';

interface OfferContextValue {
  offer: Offer | null;
  ingestOffer: (raw: unknown) => void;
  clearOffer: (bookingId?: string) => void;
}

const OfferContext = createContext<OfferContextValue | null>(null);

export function useOffer() {
  const ctx = useContext(OfferContext);
  if (!ctx) throw new Error('useOffer must be used inside OfferProvider');
  return ctx;
}

export function OfferProvider({ children }: { children: ReactNode }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const offerRef = useRef<Offer | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    offerRef.current = offer;
  }, [offer]);

  const clearExpiry = useCallback(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const clearOffer = useCallback(
    (bookingId?: string) => {
      if (bookingId && offerRef.current && offerRef.current.bookingId !== bookingId) return;
      const id = bookingId || offerRef.current?.bookingId;
      clearExpiry();
      void stopJobBuzzer();
      void dismissJobOfferNotification(id);
      setOffer(null);
    },
    [clearExpiry],
  );

  const ingestOffer = useCallback(
    (raw: unknown) => {
      if (getPresenceMode() === 'job') return;
      const next = Array.isArray(raw) ? normalizeOffers(raw)[0] : normalizeOffer(raw as any);
      if (!next?.bookingId) return;
      const isNew = offerRef.current?.bookingId !== next.bookingId;
      setOffer(next);
      if (!isNew) return;
      clearExpiry();
      const ttlMs = Math.max(5, next.offerExpiresInSec || 60) * 1000;
      expiryTimer.current = setTimeout(() => {
        clearOffer(next.bookingId);
      }, ttlMs);
      void startJobBuzzer({ force: true });
      void presentJobOfferNotification(next);
    },
    [clearOffer, clearExpiry],
  );

  const respondFromNotification = useCallback(
    async (bookingId: string, accepted: boolean) => {
      await respondToOffer(bookingId, accepted);
      clearOffer(bookingId);
      if (accepted) {
        markOnJob(bookingId);
        router.push(`/job/${bookingId}`);
      }
    },
    [clearOffer],
  );

  useEffect(() => {
    return bindOfferBridge({
      ingest: ingestOffer,
      respond: respondFromNotification,
      clear: clearOffer,
    });
  }, [ingestOffer, respondFromNotification, clearOffer]);

  const hydratePending = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    if (getPresenceMode() === 'job') return;
    try {
      const pending = await getPendingOffers();
      if (pending[0]) ingestOffer(pending[0]);
    } catch {
      // socket/push still cover live offers
    }
  }, [ingestOffer]);

  useEffect(() => {
    let cancelled = false;
    let unsubOffer: (() => void) | undefined;

    async function startSession() {
      const token = await getToken();
      if (!token || cancelled) return;
      await connectSocket();
      if (cancelled) return;
      unsubOffer?.();
      unsubOffer = onOffer((o) => ingestOffer(o));
      await hydratePending();
    }

    void startSession();
    const unbindResume = bindResumeOffers(() => {
      void startSession();
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void startSession();
        if (offerRef.current) void startJobBuzzer();
      }
    });

    return () => {
      cancelled = true;
      unsubOffer?.();
      unbindResume();
      sub.remove();
      clearExpiry();
    };
  }, [ingestOffer, hydratePending, clearExpiry]);

  const value = useMemo(
    () => ({ offer, ingestOffer, clearOffer }),
    [offer, ingestOffer, clearOffer],
  );

  return (
    <OfferContext.Provider value={value}>
      {children}
      <Modal
        visible={!!offer}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        {offer ? (
          <OfferCard
            offer={offer}
            fullscreen
            onResponded={() => clearOffer(offer.bookingId)}
          />
        ) : null}
      </Modal>
    </OfferContext.Provider>
  );
}
