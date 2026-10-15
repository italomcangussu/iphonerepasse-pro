// Localização como evidência de assinatura: só com permissão consciente; recusa vira registro, nunca coordenada inventada.
export type GeoPermission = 'concedida' | 'nao_compartilhada' | 'indisponivel';

export interface GeoEvidenceInput {
  permission: GeoPermission;
  lat?: number;
  lon?: number;
  accuracy?: number;
  capturedAt?: string;
}

export function captureGeo(timeoutMs = 8000): Promise<GeoEvidenceInput> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve({ permission: 'indisponivel' });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          permission: 'concedida',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      (error) => resolve({ permission: error.code === error.PERMISSION_DENIED ? 'nao_compartilhada' : 'indisponivel' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
