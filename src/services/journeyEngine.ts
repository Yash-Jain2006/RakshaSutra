import { defaultLocationProvider, type LocationReading } from './providers/locationProvider';
import {
  defaultRoutingProvider,
  haversineDistanceMeters,
  minDistanceToPolyline,
  type RouteResult,
  type TransportMode,
} from './providers/routingProvider';
import { offlineLocationQueue } from './offlineQueue';

export type JourneyEngineStatus =
  | 'idle'
  | 'ready'
  | 'started'
  | 'active'
  | 'approaching'
  | 'arrived'
  | 'cancelled'
  | 'sos'
  | 'gps_unavailable'
  | 'offline';

export interface MilestoneEvent {
  id: string;
  title: string;
  subtext: string;
  time: string;
  completed: boolean;
}

export interface JourneyEngineState {
  journeyId: string | null;
  status: JourneyEngineStatus;
  destinationName: string;
  destinationCoords: [number, number] | null; // [lat, lng]
  currentLocation: LocationReading | null;
  transportMode: TransportMode;
  route: RouteResult | null;
  remainingDistanceMeters: number;
  etaSeconds: number;
  activeViewersCount: number;
  timeline: MilestoneEvent[];
  isBackgrounded: boolean;
  backgroundNotice: string | null;
  isOffline: boolean;
  /**
   * Journey-local monotonically increasing counter.
   * Increments with every persisted GPS point. Starts at 1 at journey start.
   * Used to reconstruct chronological route order during out-of-order batch uploads.
   */
  sequenceNumber: number;
}

type StateListener = (state: JourneyEngineState) => void;
type LocationUploadHandler = (
  journeyId: string,
  point: {
    sequence_number: number;
    client_timestamp: string;
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    speed: number | null;
    heading: number | null;
    eta_seconds: number;
    remaining_distance_meters: number;
  }
) => Promise<void>;

/**
 * Singleton Journey Engine
 *
 * SINGLETON CONTRACT (Change #4):
 * There must NEVER be more than one GPS watcher, offline flush loop, route refresh timer,
 * or journey realtime/polling process for the same active journey.
 * Navigating between screens (Home ↔ JourneyScreen) must NOT restart tracking.
 * The `startJourney()` method is idempotent: if called again with the same journeyId
 * while tracking is already active, it returns immediately without creating duplicates.
 * The singleton is enforced by the `activeJourneyEngine` module-level export below.
 *
 * SEQUENCE NUMBER CONTRACT (Change #2):
 * Every persisted GPS point carries a monotonically increasing `sequence_number` scoped
 * to the journey (journey-local, resets to 1 at journey start). Points uploaded in a
 * batch or after offline reconnection MUST be ordered by `sequence_number` to reconstruct
 * the canonical route, regardless of server arrival order.
 * Batch uploads are idempotent: re-uploading a point with an existing sequence_number
 * for the same journey_id must be handled gracefully by the server (UPSERT / ON CONFLICT DO NOTHING).
 *
 * Manages the active journey lifecycle, adaptive throttling, hysteresis for deviation & arrival,
 * offline queue, wake lock, and provides a single source of truth across all components.
 */
class JourneyEngine {
  private state: JourneyEngineState = {
    journeyId: null,
    status: 'idle',
    destinationName: '',
    destinationCoords: null,
    currentLocation: null,
    transportMode: 'walking',
    route: null,
    remainingDistanceMeters: 0,
    etaSeconds: 0,
    activeViewersCount: 0,
    timeline: [],
    isBackgrounded: false,
    backgroundNotice: null,
    isOffline: !navigator.onLine,
    sequenceNumber: 0,
  };

  private listeners = new Set<StateListener>();
  private unwatchLocation: (() => void) | null = null;
  private wakeLock: any = null;
  private uploadHandler: LocationUploadHandler | null = null;

  // Adaptive throttling & hysteresis tracking
  private lastPersistedLocation: LocationReading | null = null;
  private lastPersistTimestamp = 0;
  private consecutiveOffRouteCount = 0;
  private consecutiveArrivalCount = 0;
  private lastRouteRecalculationTimestamp = 0;
  private flushIntervalId: number | null = null;

  constructor() {
    // Online / offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
  }

  public setUploadHandler(handler: LocationUploadHandler) {
    this.uploadHandler = handler;
  }

  public getState(): JourneyEngineState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    for (const listener of this.listeners) {
      listener(s);
    }
  }

  private updateState(partial: Partial<JourneyEngineState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  /**
   * Start a new active journey (Idempotent: will not duplicate if already running for this journeyId).
   */
  public async startJourney(params: {
    journeyId: string;
    destinationName: string;
    destinationCoords: [number, number];
    startLocation: LocationReading;
    transportMode: TransportMode;
    initialRoute?: RouteResult | null;
    activeViewersCount?: number;
  }): Promise<void> {
    if (this.state.journeyId === params.journeyId && this.unwatchLocation) {
      console.log('[JourneyEngine] Journey is already actively tracked.');
      return;
    }

    // Stop any previous tracking
    this.stopTracking();

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Initial timeline
    const timeline: MilestoneEvent[] = [
      {
        id: 'start',
        title: 'Trip started',
        subtext: `Starting point, ${timeStr}`,
        time: timeStr,
        completed: true,
      },
      {
        id: 'checkpoint',
        title: 'On route',
        subtext: 'Tracking safe progress',
        time: '',
        completed: false,
      },
      {
        id: 'approaching',
        title: 'Approaching destination',
        subtext: 'Within 300m',
        time: '',
        completed: false,
      },
      {
        id: 'arrived',
        title: 'Safe arrival notification',
        subtext: 'Sent to emergency contacts',
        time: '',
        completed: false,
      },
    ];

    let route = params.initialRoute || null;
    if (!route) {
      try {
        route = await defaultRoutingProvider.calculateRoute(
          [params.startLocation.latitude, params.startLocation.longitude],
          params.destinationCoords,
          params.transportMode
        );
      } catch (err) {
        console.warn('[JourneyEngine] Initial route calculation error:', err);
      }
    }

    const distMeters = route ? route.distanceMeters : haversineDistanceMeters(
      params.startLocation.latitude,
      params.startLocation.longitude,
      params.destinationCoords[0],
      params.destinationCoords[1]
    );

    const etaSecs = route ? route.durationSeconds : Math.round(distMeters / 1.35);

    this.state = {
      journeyId: params.journeyId,
      status: 'active',
      destinationName: params.destinationName,
      destinationCoords: params.destinationCoords,
      currentLocation: params.startLocation,
      transportMode: params.transportMode,
      route,
      remainingDistanceMeters: distMeters,
      etaSeconds: etaSecs,
      activeViewersCount: params.activeViewersCount || 0,
      timeline,
      isBackgrounded: false,
      backgroundNotice: null,
      isOffline: !navigator.onLine,
      sequenceNumber: 1,
    };
    this.notify();

    // Acquire wake lock (best effort)
    this.requestWakeLock();

    // Persist first location point
    this.persistLocation(params.startLocation, distMeters, etaSecs);

    // Start continuous singleton location watcher
    this.unwatchLocation = defaultLocationProvider.watchPosition(
      (loc) => this.handleLocationUpdate(loc),
      (err) => this.handleLocationError(err)
    );

    // Start background offline queue flush loop (every 10 seconds)
    this.flushIntervalId = window.setInterval(() => this.flushOfflineQueue(), 10000);
  }

  /**
   * Main location update handler with adaptive throttling & double hysteresis.
   */
  private async handleLocationUpdate(reading: LocationReading) {
    if (!this.state.destinationCoords || this.state.status === 'arrived' || this.state.status === 'cancelled') {
      return;
    }

    // Noise filter: reject readings with accuracy > 60m unless no fix for > 30s
    const timeSinceLastFix = Date.now() - (this.state.currentLocation?.timestamp || 0);
    if (reading.accuracy > 60 && timeSinceLastFix < 30000) {
      console.log(`[JourneyEngine] Filtered noisy GPS reading (${reading.accuracy.toFixed(0)}m)`);
      return;
    }

    const [destLat, destLng] = this.state.destinationCoords;
    const distanceToDest = haversineDistanceMeters(
      reading.latitude,
      reading.longitude,
      destLat,
      destLng
    );

    // Calculate dynamic ETA along remaining distance
    const speed = reading.speed && reading.speed > 0.5
      ? reading.speed
      : this.state.transportMode === 'driving' ? 8.5 : this.state.transportMode === 'cycling' ? 4.5 : 1.35;
    const etaSecs = Math.round(distanceToDest / speed);

    // Update in-memory state
    this.updateState({
      currentLocation: reading,
      remainingDistanceMeters: Math.round(distanceToDest),
      etaSeconds: etaSecs,
      status: this.state.status === 'sos' ? 'sos' : this.state.status,
    });

    // 1. ARRIVAL DETECTION WITH HYSTERESIS
    // Requires: distance <= 50m AND accuracy <= 30m AND 2 consecutive readings
    if (distanceToDest <= 50) {
      if (reading.accuracy <= 30) {
        this.consecutiveArrivalCount++;
        if (this.consecutiveArrivalCount >= 2) {
          this.triggerArrival();
          return;
        }
      }
    } else {
      this.consecutiveArrivalCount = 0;
    }

    // Approaching milestone (within 300m)
    if (distanceToDest <= 300 && this.state.status === 'active') {
      const updatedTimeline = this.state.timeline.map((item) =>
        item.id === 'approaching'
          ? { ...item, completed: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          : item
      );
      this.updateState({ status: 'approaching', timeline: updatedTimeline });
    }

    // 2. ROUTE DEVIATION DETECTION WITH 3-CONSECUTIVE-READING HYSTERESIS
    if (this.state.route && this.state.route.coordinates.length > 1) {
      const crossTrack = minDistanceToPolyline(
        [reading.latitude, reading.longitude],
        this.state.route.coordinates
      );

      if (crossTrack > 80) {
        this.consecutiveOffRouteCount++;
        const now = Date.now();
        // Recalculate ONLY if 3 consecutive readings are > 80m and not recalculated in last 20s
        if (this.consecutiveOffRouteCount >= 3 && now - this.lastRouteRecalculationTimestamp > 20000) {
          this.lastRouteRecalculationTimestamp = now;
          this.consecutiveOffRouteCount = 0;
          this.recalculateRoute([reading.latitude, reading.longitude], [destLat, destLng]);
        }
      } else {
        this.consecutiveOffRouteCount = 0;
      }
    }

    // 3. ADAPTIVE THROTTLED PERSISTENCE
    // Stationary: 45s or >15m move | Walking: 15s or >10m move | Driving: 6s or >25m move
    const now = Date.now();
    const elapsedSecs = (now - this.lastPersistTimestamp) / 1000;
    let displacementMeters = Infinity;

    if (this.lastPersistedLocation) {
      displacementMeters = haversineDistanceMeters(
        this.lastPersistedLocation.latitude,
        this.lastPersistedLocation.longitude,
        reading.latitude,
        reading.longitude
      );
    }

    let minInterval = 15;
    let minDisplacement = 10;
    if (this.state.transportMode === 'driving' || this.state.transportMode === 'transit') {
      minInterval = 6;
      minDisplacement = 25;
    } else if (reading.speed !== null && reading.speed !== undefined && reading.speed < 0.4) {
      // Stationary
      minInterval = 45;
      minDisplacement = 15;
    }

    if (elapsedSecs >= minInterval || displacementMeters >= minDisplacement) {
      this.lastPersistTimestamp = now;
      this.lastPersistedLocation = reading;
      this.persistLocation(reading, Math.round(distanceToDest), etaSecs);
    }
  }

  /**
   * Recalculates route when off-track hysteresis confirms deviation.
   */
  private async recalculateRoute(start: [number, number], dest: [number, number]) {
    try {
      console.log('[JourneyEngine] Off-route confirmed. Recalculating road route...');
      const newRoute = await defaultRoutingProvider.calculateRoute(start, dest, this.state.transportMode);
      this.updateState({
        route: newRoute,
        remainingDistanceMeters: newRoute.distanceMeters,
        etaSeconds: newRoute.durationSeconds,
      });
    } catch (err) {
      console.warn('[JourneyEngine] Route recalculation error:', err);
    }
  }

  /**
   * Persists location point to server (or buffers to IndexedDB if offline / upload fails).
   */
  private async persistLocation(reading: LocationReading, distanceMeters: number, etaSeconds: number) {
    if (!this.state.journeyId) return;

    const seq = this.state.sequenceNumber + 1;
    this.updateState({ sequenceNumber: seq });

    const point = {
      sequence_number: seq,
      client_timestamp: new Date(reading.timestamp).toISOString(),
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracy_meters: reading.accuracy || null,
      speed: reading.speed ?? null,
      heading: reading.heading ?? null,
      eta_seconds: etaSeconds,
      remaining_distance_meters: distanceMeters,
    };

    if (navigator.onLine && this.uploadHandler) {
      try {
        await this.uploadHandler(this.state.journeyId, point);
        return;
      } catch (err) {
        console.warn('[JourneyEngine] Upload failed, buffering to IndexedDB:', err);
      }
    }

    // Buffer to IndexedDB
    await offlineLocationQueue.enqueue({
      journey_id: this.state.journeyId,
      sequence_number: seq,
      client_timestamp: point.client_timestamp,
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy_meters: point.accuracy_meters,
      speed: point.speed,
      heading: point.heading,
    });
  }

  /**
   * Flushes queued points from IndexedDB to server in chronological order.
   */
  public async flushOfflineQueue() {
    if (!navigator.onLine || !this.uploadHandler || !this.state.journeyId) return;

    try {
      const pending = await offlineLocationQueue.getPendingPoints(this.state.journeyId);
      if (pending.length === 0) return;

      const uploadedIds: number[] = [];
      for (const p of pending) {
        try {
          await this.uploadHandler(p.journey_id, {
            sequence_number: p.sequence_number,
            client_timestamp: p.client_timestamp,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy_meters: p.accuracy_meters,
            speed: p.speed,
            heading: p.heading,
            eta_seconds: this.state.etaSeconds,
            remaining_distance_meters: this.state.remainingDistanceMeters,
          });
          if (p.id) uploadedIds.push(p.id);
        } catch {
          break; // Stop on first network error
        }
      }

      if (uploadedIds.length > 0) {
        await offlineLocationQueue.removePoints(uploadedIds);
        console.log(`[JourneyEngine] Flushed ${uploadedIds.length} queued points from IndexedDB.`);
      }
    } catch (err) {
      console.warn('[JourneyEngine] Flush queue error:', err);
    }
  }

  private triggerArrival() {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeline = this.state.timeline.map((item) => ({
      ...item,
      completed: true,
      time: item.time || timeStr,
    }));

    this.updateState({
      status: 'arrived',
      remainingDistanceMeters: 0,
      etaSeconds: 0,
      timeline,
    });

    this.releaseWakeLock();
    if (this.unwatchLocation) {
      this.unwatchLocation();
      this.unwatchLocation = null;
    }
  }

  public setSosState() {
    this.updateState({ status: 'sos' });
  }

  public setViewersCount(count: number) {
    this.updateState({ activeViewersCount: count });
  }

  public endJourney(reason: 'arrived' | 'cancelled' = 'arrived') {
    this.updateState({ status: reason });
    this.stopTracking();
  }

  private stopTracking() {
    if (this.unwatchLocation) {
      this.unwatchLocation();
      this.unwatchLocation = null;
    }
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    this.releaseWakeLock();
  }

  private handleLocationError(err: GeolocationPositionError) {
    console.warn('[JourneyEngine] GPS Error:', err.message);
    if (err.code === err.PERMISSION_DENIED) {
      this.updateState({ status: 'gps_unavailable' });
    } else if (err.code === err.POSITION_UNAVAILABLE || err.code === err.TIMEOUT) {
      this.updateState({ status: 'gps_unavailable' });
    }
  }

  private handleNetworkChange(online: boolean) {
    this.updateState({ isOffline: !online });
    if (online) {
      this.flushOfflineQueue();
    }
  }

  private handleVisibilityChange() {
    const isHidden = document.visibilityState === 'hidden';
    this.updateState({
      isBackgrounded: isHidden,
      backgroundNotice: isHidden ? 'Location updates may pause while backgrounded.' : null,
    });

    if (!isHidden) {
      // Returned to foreground: request fresh GPS fix immediately
      defaultLocationProvider.getCurrentPosition().then((loc) => {
        this.handleLocationUpdate(loc);
      }).catch(() => {});
    }
  }

  private async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Best effort; ignore failure
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }
}

export const activeJourneyEngine = new JourneyEngine();
