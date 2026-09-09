export interface LocationReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
}

export interface LocationProvider {
  getCurrentPosition(): Promise<LocationReading>;
  watchPosition(
    onSuccess: (loc: LocationReading) => void,
    onError: (err: GeolocationPositionError) => void
  ): () => void;
  checkPermission(): Promise<PermissionState>;
}

export class BrowserLocationProvider implements LocationProvider {
  async getCurrentPosition(): Promise<LocationReading> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            timestamp: pos.timestamp || Date.now(),
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000,
        }
      );
    });
  }

  watchPosition(
    onSuccess: (loc: LocationReading) => void,
    onError: (err: GeolocationPositionError) => void
  ): () => void {
    if (!navigator.geolocation) {
      onError({
        code: 2,
        message: 'Geolocation is not supported by your browser.',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onSuccess({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (err) => onError(err),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 2000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }

  async checkPermission(): Promise<PermissionState> {
    if (!navigator.permissions || !navigator.permissions.query) {
      return 'prompt';
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state;
    } catch {
      return 'prompt';
    }
  }
}

export const defaultLocationProvider = new BrowserLocationProvider();
