import { DeviceType, type DeviceCatalogItem } from '../../types';
import { getAllKnownDeviceModels, getPredefinedModelColors } from './stockDeviceOptions';

type ImeiLookupApiPayload = {
  model?: string;
  description?: string;
  error?: string;
} | null | undefined;

type LookupFailure = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

export type ImeiLookupResponseResolution =
  | {
      kind: 'identified';
      apiModel: string;
      detectedType: DeviceType;
      model: string;
      capacity: string | null;
      color: string | null;
    }
  | {
      kind: 'unmatched';
      apiModel: string;
      detectedType: DeviceType;
    }
  | {
      kind: 'api-error';
      message: string;
    };

const detectDeviceType = (text: string): DeviceType => {
  if (text.includes('ipad')) return DeviceType.IPAD;
  if (text.includes('watch')) return DeviceType.WATCH;
  if (text.includes('macbook')) return DeviceType.MACBOOK;
  return DeviceType.IPHONE;
};

const extractCapacity = (text: string): string | null => {
  const capacityMatch = text.match(/(\d+)\s*(gb|tb)/i);
  return capacityMatch
    ? capacityMatch[0].toUpperCase().replace('GB', ' GB').replace('TB', ' TB')
    : null;
};

export const resolveImeiLookupResponse = (
  payload: ImeiLookupApiPayload,
  deviceCatalog: DeviceCatalogItem[]
): ImeiLookupResponseResolution => {
  if (!payload || payload.error) {
    return {
      kind: 'api-error',
      message: payload?.error || 'IMEI não encontrado.',
    };
  }

  const apiModel = payload.model || '';
  const apiDescription = payload.description || '';
  const fullText = `${apiModel} ${apiDescription}`.toLowerCase();
  const detectedType = detectDeviceType(fullText);
  const allModels = getAllKnownDeviceModels(deviceCatalog);
  const foundModel = allModels.find((model) => fullText.includes(model.toLowerCase()));

  if (!foundModel) {
    return {
      kind: 'unmatched',
      apiModel,
      detectedType,
    };
  }

  const modelColors = getPredefinedModelColors(foundModel);
  const foundColor = modelColors.find((color) => fullText.includes(color.toLowerCase())) || null;

  return {
    kind: 'identified',
    apiModel,
    detectedType,
    model: foundModel,
    capacity: extractCapacity(fullText),
    color: foundColor,
  };
};

export const getImeiLookupFailureMessage = (error: LookupFailure): string => {
  const status = error.response?.status;
  const message = error.response?.data?.message || error.message;

  if (status === 401 || status === 403) {
    return 'Erro de autenticação: Verifique sua chave da RapidAPI.';
  }

  if (status === 429) {
    return 'Limite de requisições excedido na RapidAPI.';
  }

  return `Falha na consulta: ${message}`;
};
