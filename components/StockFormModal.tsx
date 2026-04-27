import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Modal from './ui/Modal';
import { useData } from '../services/dataContext';
import { DeviceType, Condition, StockStatus, WarrantyType, StockItem, CostItem } from '../types';
import { APPLE_MODELS, CAPACITIES, COLORS, MODEL_COLORS } from '../constants';
import { Smartphone, Battery, Camera, DollarSign, Wrench, X, Tag, Plus, Trash2, ChevronRight, Loader2, Search, Image as ImageIcon, Star, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useToast } from './ui/ToastProvider';
import { uploadImage } from '../services/storage';
import { newId } from '../utils/id';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/inputMasks';
import { Combobox } from './ui/Combobox';
import {
  MAX_DEVICE_IMAGE_SIZE_BYTES,
  MAX_STOCK_PHOTOS,
  clampFilesToPhotoLimit,
  ensureSingleCoverInQueue,
  mergeUploadBatchOutcome,
  mergeUploadedPhotosWithCover,
  moveItemInArray,
  preparePhotoForUpload,
  resolveSaveBlockReason,
  setQueueCover,
  type LocalPhotoQueueItem,
  type UploadBatchOutcome,
} from '../utils/stockPhotoWorkflow';

interface StockFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: StockItem; // If provided, we are editing
  onSave?: (item: StockItem) => void;
  onDelete?: () => void | Promise<void>;
  defaultStatus?: StockStatus; // When set, skip status prompt and use this status directly
  draftContext?: 'inventory' | 'pdv-tradein';
}

type Tab = 'info' | 'condition' | 'financial';
type DeviceFamily = 'ios' | 'android' | 'desktop';
type PhotoInputSource = 'camera' | 'gallery';

const BATTERY_HEALTH_MIN = 0;
const BATTERY_HEALTH_MAX = 100;

const ALLOWED_DEVICE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const detectDeviceFamily = (): DeviceFamily => {
  if (typeof navigator === 'undefined') return 'desktop';

  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
};

const clampBatteryHealth = (value: number) =>
  Math.min(BATTERY_HEALTH_MAX, Math.max(BATTERY_HEALTH_MIN, Math.round(value)));

const resolveImageMimeType = (file: File) => {
  const rawType = (file.type || '').trim().toLowerCase();
  if (rawType) {
    if (rawType === 'image/jpg') return 'image/jpeg';
    return rawType;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[extension] || '';
};

type StockFormDraftState = {
  formData: Partial<StockItem>;
  activeTab: Tab;
  localPhotoQueue: LocalPhotoQueueItem[];
  isCameraCaptureMode: boolean;
};

const stockFormDraftCache = new Map<'inventory' | 'pdv-tradein', StockFormDraftState>();

export const StockFormModal: React.FC<StockFormModalProps> = ({
  open,
  onClose,
  initialData,
  onSave,
  onDelete,
  defaultStatus,
  draftContext,
}) => {
  const {
    addStockItem,
    updateStockItem,
    stores,
    addCostHistory,
    getCostHistoryByModel,
    addCostToItem,
    partsInventory,
    addPartCostToItem,
    deviceCatalog,
    addDeviceCatalogItem
  } = useData();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<Tab>('info');
  
  // Form State
  const defaultState: Partial<StockItem> = {
    type: DeviceType.IPHONE,
    condition: Condition.USED,
    status: StockStatus.AVAILABLE,
    simType: 'Physical',
    storeId: stores.length > 0 ? stores[0].id : '',
    batteryHealth: 100,
    warrantyType: WarrantyType.STORE,
    costs: [],
    photos: [],
    origin: '',
    notes: '',
    observations: '',
    hasBox: false,
    purchasePrice: 0,
    maxDiscount: 0,
    // explicitly set empty strings for controlled inputs
    model: '',
    color: '',
    capacity: '128 GB',
    imei: '',
  };

  const [formData, setFormData] = useState<Partial<StockItem>>(defaultState);
  
  // Cost logic
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [newCostDescription, setNewCostDescription] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partUsageQuantity, setPartUsageQuantity] = useState('1');


  const [costHistory, setCostHistory] = useState<CostItem[]>([]);
  const [showStatusPrompt, setShowStatusPrompt] = useState(false);
  const [isLoadingIMEI, setIsLoadingIMEI] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPhotoSourceModalOpen, setIsPhotoSourceModalOpen] = useState(false);
  const [localPhotoQueue, setLocalPhotoQueue] = useState<LocalPhotoQueueItem[]>([]);
  const [isCameraCaptureMode, setIsCameraCaptureMode] = useState(false);
  const [isNewDeviceModalOpen, setIsNewDeviceModalOpen] = useState(false);
  const [isSavingNewDevice, setIsSavingNewDevice] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    type: DeviceType.IPHONE as DeviceType,
    model: '',
    color: ''
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const deviceFamily = useMemo<DeviceFamily>(() => detectDeviceFamily(), []);
  const isIOS = deviceFamily === 'ios';
  const isDesktop = deviceFamily === 'desktop';
  const galleryOptionLabel = isDesktop ? 'Escolher arquivo' : 'Escolher da galeria';
  const uploadedPhotos = formData.photos || [];
  const rawIdentifier = (formData.imei || '').trim();
  const identifierDigits = rawIdentifier.replace(/\D/g, '');
  const identifierIsOnlyDigits = rawIdentifier.length > 0 && identifierDigits.length === rawIdentifier.length;
  const supportsImeiLookup = formData.type === DeviceType.IPHONE || formData.type === DeviceType.IPAD;
  const canLookupByImei = supportsImeiLookup && identifierIsOnlyDigits && identifierDigits.length >= 8;
  const queuedPendingCount = localPhotoQueue.filter((item) => item.status === 'pending').length;
  const queuedFailedCount = localPhotoQueue.filter((item) => item.status === 'failed').length;
  const hasQueuedPending = queuedPendingCount > 0;
  const hasQueuedFailed = queuedFailedCount > 0;
  const totalPhotoCount = uploadedPhotos.length + localPhotoQueue.length;
  const isPhotoLimitReached = totalPhotoCount >= MAX_STOCK_PHOTOS;
  const batteryHealthValue = formData.batteryHealth;
  const batteryHealthStatus =
    typeof batteryHealthValue !== 'number'
      ? { label: 'Informe entre 0% e 100%', colorClass: 'text-gray-500 dark:text-surface-dark-500', iconClass: 'text-gray-400' }
      : batteryHealthValue < 80
        ? { label: 'Manutenção recomendada', colorClass: 'text-red-500', iconClass: 'text-red-500' }
        : batteryHealthValue < 90
          ? { label: 'Saúde boa', colorClass: 'text-amber-500', iconClass: 'text-amber-500' }
          : { label: 'Saúde excelente', colorClass: 'text-green-500', iconClass: 'text-green-500' };

  // Derived state
  const isEditing = !!initialData;
  const isPdvTradeInDraft = draftContext === 'pdv-tradein' && !isEditing;
  const isEditingPreparation = isEditing && (initialData?.status === StockStatus.PREPARATION || formData.status === StockStatus.PREPARATION);
  const currentModels = useMemo(() => {
    const selectedType = formData.type || DeviceType.IPHONE;
    const predefinedModels = APPLE_MODELS[selectedType] || [];
    const customModels = deviceCatalog
      .filter((entry) => entry.type === selectedType)
      .map((entry) => entry.model);

    return Array.from(new Set([...predefinedModels, ...customModels]));
  }, [formData.type, deviceCatalog]);

  const currentModelColors = useMemo(() => {
    if (!formData.model) return [];
    const selectedType = formData.type || DeviceType.IPHONE;

    const predefinedColors = MODEL_COLORS[formData.model] || [];
    const customColors = deviceCatalog
      .filter((entry) => entry.type === selectedType && entry.model === formData.model && entry.color)
      .map((entry) => entry.color as string);

    return Array.from(new Set([...predefinedColors, ...customColors]));
  }, [formData.model, formData.type, deviceCatalog]);

  const revokePreviewUrl = useCallback((previewUrl: string) => {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    try {
      URL.revokeObjectURL(previewUrl);
    } catch {
      // no-op
    }
  }, []);

  const replaceLocalPhotoQueue = useCallback(
    (updater: (prev: LocalPhotoQueueItem[]) => LocalPhotoQueueItem[]) => {
      setLocalPhotoQueue((prev) => {
        const next = ensureSingleCoverInQueue(updater(prev));
        const nextIds = new Set(next.map((item) => item.id));
        prev
          .filter((item) => !nextIds.has(item.id))
          .forEach((item) => {
            revokePreviewUrl(item.previewUrl);
          });
        return next;
      });
    },
    [revokePreviewUrl]
  );

  const clearLocalPhotoQueue = useCallback(() => {
    setLocalPhotoQueue((prev) => {
      prev.forEach((item) => revokePreviewUrl(item.previewUrl));
      return [];
    });
  }, [revokePreviewUrl]);

  const openCameraPicker = useCallback(() => {
    const input = cameraInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Fallback to click for browsers that throw on showPicker.
      }
    }

    input.click();
  }, []);

  const requestNextCameraCapture = useCallback(() => {
    // iOS Safari is strict about user activation; trigger immediately and
    // keep a short fallback attempt for devices that need a tiny delay.
    queueMicrotask(() => {
      openCameraPicker();
    });

    window.setTimeout(() => {
      openCameraPicker();
    }, 220);
  }, [openCameraPicker]);

  const clearDraft = useCallback(() => {
    if (!draftContext) return;
    stockFormDraftCache.delete(draftContext);
  }, [draftContext]);
  
  useEffect(() => {
    if (open) {
      setIsAddCostOpen(false);
      setIsAddPartOpen(false);
      setSelectedPartId('');
      setPartUsageQuantity('1');
      setIsUploading(false);
      setShowStatusPrompt(false);
      setIsPhotoSourceModalOpen(false);

      if (initialData) {
        setFormData({
          ...defaultState,
          ...initialData,
          observations: initialData.observations ?? initialData.notes ?? ''
        });
        clearLocalPhotoQueue();
        setIsCameraCaptureMode(false);
        setActiveTab('info');
        return;
      }

      const savedDraft = draftContext ? stockFormDraftCache.get(draftContext) : null;
      if (savedDraft) {
        setFormData({
          ...defaultState,
          ...savedDraft.formData,
          storeId:
            savedDraft.formData.storeId ||
            defaultState.storeId ||
            (stores.length > 0 ? stores[0].id : ''),
        });
        setLocalPhotoQueue(ensureSingleCoverInQueue(savedDraft.localPhotoQueue));
        setIsCameraCaptureMode(savedDraft.isCameraCaptureMode);
        setActiveTab(savedDraft.activeTab);
      } else {
        setFormData({
            ...defaultState,
            storeId: stores.length > 0 ? stores[0].id : '',
        });
        clearLocalPhotoQueue();
        setIsCameraCaptureMode(false);
        setActiveTab('info');
      }
    }
  }, [open, initialData, stores, draftContext, clearLocalPhotoQueue]);

  useEffect(() => {
    if (!open) {
      setIsPhotoSourceModalOpen(false);
      setIsCameraCaptureMode(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !!initialData || !draftContext) return;

    stockFormDraftCache.set(draftContext, {
      formData,
      activeTab,
      localPhotoQueue,
      isCameraCaptureMode,
    });
  }, [open, initialData, draftContext, formData, activeTab, localPhotoQueue, isCameraCaptureMode]);

  // Load cost history when model changes
  useEffect(() => {
    if (!formData.model) {
      setCostHistory([]);
      return;
    }
    const history = getCostHistoryByModel(formData.model);
    setCostHistory(history.map(h => ({
      id: h.id,
      description: h.description,
      amount: h.amount,
      date: h.lastUsed
    })));
  }, [formData.model, getCostHistoryByModel]);

  const handleBatteryHealthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    if (rawValue === '') {
      setFormData(prev => ({ ...prev, batteryHealth: undefined }));
      return;
    }

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return;

    setFormData(prev => ({ ...prev, batteryHealth: numericValue }));
  };

  const handleBatteryHealthBlur = () => {
    setFormData(prev => {
      if (typeof prev.batteryHealth !== 'number' || Number.isNaN(prev.batteryHealth)) {
        return { ...prev, batteryHealth: 100 };
      }
      return { ...prev, batteryHealth: clampBatteryHealth(prev.batteryHealth) };
    });
  };

  const handleMoneyChange =
    (field: 'purchasePrice' | 'sellPrice') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const amount = parseCurrencyBRL(event.target.value);
      setFormData(prev => ({ ...prev, [field]: amount }));
    };

  const performSave = async (statusOverride?: StockStatus) => {
    const purchasePrice = Number(formData.purchasePrice || 0);
    const sellPrice = Number(formData.sellPrice || 0);
    const observations = formData.observations ?? formData.notes ?? '';

    const itemData: StockItem = {
      id: formData.id || newId('stk'),
      type: formData.type || DeviceType.IPHONE,
      model: formData.model,
      color: formData.color || '',
      hasBox: formData.hasBox ?? false,
      capacity: formData.capacity || '',
      imei: formData.imei || '',
      condition: formData.condition || Condition.USED,
      status: statusOverride || formData.status || StockStatus.AVAILABLE,
      simType: formData.simType || 'Physical',
      batteryHealth:
        formData.condition === Condition.USED
          ? clampBatteryHealth(formData.batteryHealth ?? 100)
          : undefined,
      storeId: formData.storeId || (stores.length > 0 ? stores[0].id : ''),
      purchasePrice,
      sellPrice,
      maxDiscount: Number(formData.maxDiscount || 0),
      warrantyType: formData.warrantyType || WarrantyType.STORE,
      warrantyEnd: formData.warrantyEnd,
      origin: formData.origin || '',
      notes: observations,
      observations,
      costs: formData.costs || [],
      photos: formData.photos || [],
      entryDate: formData.entryDate || new Date().toISOString(),
    };

    try {
      if (isEditing && initialData?.id) {
        await updateStockItem(initialData.id, itemData);
        toast.success('Aparelho atualizado com sucesso!');
      } else if (isPdvTradeInDraft) {
        toast.success('Trade-in adicionado ao rascunho da venda.');
      } else {
        await addStockItem(itemData);
        toast.success('Aparelho cadastrado com sucesso!');
      }

      clearDraft();
      clearLocalPhotoQueue();
      setShowStatusPrompt(false);
      setIsCameraCaptureMode(false);
      if (onSave) onSave(itemData);
      onClose();
    } catch (error: any) {
      toast.error('Erro ao salvar aparelho: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const removeUploadedPhoto = (index: number) => {
    setFormData((prev) => {
      const photos = prev.photos || [];
      if (index < 0 || index >= photos.length) return prev;
      return {
        ...prev,
        photos: photos.filter((_, idx) => idx !== index),
      };
    });
  };

  const moveUploadedPhoto = (index: number, direction: -1 | 1) => {
    setFormData((prev) => {
      const photos = prev.photos || [];
      const nextIndex = index + direction;
      if (index < 0 || index >= photos.length) return prev;
      if (nextIndex < 0 || nextIndex >= photos.length) return prev;
      return {
        ...prev,
        photos: moveItemInArray(photos, index, nextIndex),
      };
    });
  };

  const setUploadedPhotoAsCover = (index: number) => {
    setFormData((prev) => {
      const photos = prev.photos || [];
      if (index < 0 || index >= photos.length) return prev;
      return {
        ...prev,
        photos: moveItemInArray(photos, index, 0),
      };
    });
  };

  const removeQueuedPhoto = (photoId: string) => {
    replaceLocalPhotoQueue((prev) => prev.filter((item) => item.id !== photoId));
  };

  const moveQueuedPhoto = (photoId: string, direction: -1 | 1) => {
    replaceLocalPhotoQueue((prev) => {
      const index = prev.findIndex((item) => item.id === photoId);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      return moveItemInArray(prev, index, nextIndex);
    });
  };

  const setQueuedPhotoAsCover = (photoId: string) => {
    replaceLocalPhotoQueue((prev) => setQueueCover(prev, photoId));
  };

  const uploadQueuedPhotos = async (trigger: 'manual' | 'save') => {
    const queueSnapshot = localPhotoQueue;
    const uploadTargets = queueSnapshot.filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    );

    if (uploadTargets.length === 0) {
      if (trigger === 'manual') {
        toast.info('Não há fotos pendentes para enviar.');
      }
      return { successCount: 0, failedCount: 0 };
    }

    setIsUploading(true);
    const targetIds = new Set(uploadTargets.map((item) => item.id));

    replaceLocalPhotoQueue((prev) =>
      prev.map((item) =>
        targetIds.has(item.id)
          ? {
              ...item,
              status: 'uploading',
              error: undefined,
            }
          : item
      )
    );

    try {
      const outcomes: UploadBatchOutcome[] = [];

      for (const queueItem of uploadTargets) {
        const preparedFile = await preparePhotoForUpload(queueItem.file, {
          isMobile: !isDesktop,
        });

        try {
          const publicUrl = await uploadImage(preparedFile, 'device-images');
          outcomes.push({
            id: queueItem.id,
            status: 'fulfilled',
            url: publicUrl,
          });
        } catch (error: any) {
          outcomes.push({
            id: queueItem.id,
            status: 'rejected',
            error: error?.message || 'Falha no upload.',
          });
        }
      }

      const coverCandidateId = uploadTargets.find((item) => item.isCover)?.id;
      const coverUploadedUrl =
        coverCandidateId
          ? outcomes.find(
              (outcome): outcome is Extract<UploadBatchOutcome, { status: 'fulfilled' }> =>
                outcome.status === 'fulfilled' && outcome.id === coverCandidateId
            )?.url
          : undefined;

      const { uploadedUrls, nextQueue, successCount, failedCount } = mergeUploadBatchOutcome(
        queueSnapshot,
        outcomes
      );

      replaceLocalPhotoQueue(() => nextQueue);

      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          photos: mergeUploadedPhotosWithCover(prev.photos || [], uploadedUrls, coverUploadedUrl),
        }));
        toast.success(`${uploadedUrls.length} foto(s) enviada(s) com sucesso.`);
      }

      if (failedCount > 0) {
        toast.error(
          `${failedCount} foto(s) falharam no upload. Corrija e toque em \"Tentar novamente\".`
        );
      }

      return { successCount, failedCount };
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveClick = async () => {
    const saveBlockReason = resolveSaveBlockReason({
      isUploading,
      hasPendingUploads: hasQueuedPending,
      hasFailedUploads: hasQueuedFailed,
    });

    if (saveBlockReason === 'uploading') {
      toast.info('Aguarde o upload das fotos terminar antes de concluir o cadastro.');
      setActiveTab('condition');
      return;
    }

    // Validation
    if (!formData.model) {
      toast.error('Informe o modelo do aparelho');
      setActiveTab('info');
      return;
    }
    if (!defaultStatus && !formData.sellPrice) {
      toast.error('Informe o preço de venda');
      setActiveTab('financial');
      return;
    }
    if (!formData.storeId) {
      toast.error('Selecione a loja do aparelho');
      setActiveTab('info');
      return;
    }

    if (hasQueuedPending || hasQueuedFailed) {
      setActiveTab('condition');
      const uploadResult = await uploadQueuedPhotos('save');
      if (uploadResult.failedCount > 0) {
        toast.info('Resolva as fotos com falha para concluir o cadastro.');
        return;
      }
    }

    // When defaultStatus is set (e.g. trade-in), skip the status prompt
    if (defaultStatus) {
      performSave(defaultStatus);
    } else if (!isEditing && formData.condition === Condition.USED) {
      setShowStatusPrompt(true);
    } else {
      performSave();
    }
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: PhotoInputSource
  ) => {
    const files: File[] = e.target.files ? [...e.target.files] : [];
    const isCameraInput = source === 'camera';

    if (files.length === 0) {
      if (isCameraInput) {
        setIsCameraCaptureMode(false);
      }
      e.target.value = '';
      return;
    }

    const validFiles: File[] = [];
    const unsupportedFiles: string[] = [];
    const oversizedFiles: string[] = [];

    files.forEach((file, index) => {
      const fileLabel = file.name?.trim() || `Arquivo ${index + 1}`;
      const mimeType = resolveImageMimeType(file);

      if (!ALLOWED_DEVICE_IMAGE_MIME_TYPES.has(mimeType)) {
        unsupportedFiles.push(fileLabel);
        return;
      }

      if (file.size > MAX_DEVICE_IMAGE_SIZE_BYTES) {
        oversizedFiles.push(fileLabel);
        return;
      }

      validFiles.push(file);
    });

    if (unsupportedFiles.length > 0) {
      toast.error(`Formato não suportado em: ${unsupportedFiles[0]}. Use JPEG, PNG, WEBP ou HEIC.`, {
        title: 'Arquivo inválido',
        durationMs: 7000,
      });
    }

    if (oversizedFiles.length > 0) {
      toast.error(`Arquivo acima de 15 MB: ${oversizedFiles[0]}.`, {
        title: 'Imagem muito grande',
        durationMs: 7000,
      });
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    const { acceptedFiles, overflowCount, availableSlots } = clampFilesToPhotoLimit({
      uploadedCount: uploadedPhotos.length,
      queuedCount: localPhotoQueue.length,
      incomingFiles: validFiles,
      maxPhotos: MAX_STOCK_PHOTOS,
    });

    if (acceptedFiles.length === 0) {
      toast.info(`Limite de ${MAX_STOCK_PHOTOS} fotos por aparelho atingido.`);
      setIsCameraCaptureMode(false);
      e.target.value = '';
      return;
    }

    if (overflowCount > 0) {
      toast.info(
        `Só foi possível adicionar ${acceptedFiles.length} foto(s). Restavam ${availableSlots} vaga(s).`
      );
    }

    replaceLocalPhotoQueue((prev) => {
      const hasCover = prev.some((item) => item.isCover);
      const shouldCreateCover = !hasCover && uploadedPhotos.length === 0;
      const additions: LocalPhotoQueueItem[] = acceptedFiles.map((file, index) => ({
        id: newId('qphoto'),
        file,
        previewUrl: URL.createObjectURL(file),
        source,
        status: 'pending',
        error: undefined,
        isCover: shouldCreateCover && prev.length === 0 && index === 0,
      }));
      return [...prev, ...additions];
    });

    if (isCameraInput && isCameraCaptureMode && isIOS) {
      const totalAfterSelection = uploadedPhotos.length + localPhotoQueue.length + acceptedFiles.length;
      if (totalAfterSelection < MAX_STOCK_PHOTOS) {
        requestNextCameraCapture();
      } else {
        setIsCameraCaptureMode(false);
        toast.info(`Limite de ${MAX_STOCK_PHOTOS} fotos atingido.`);
      }
    }

    e.target.value = '';
  };

  const confirmAddNewCost = async () => {
    if (!newCostDescription || !newCostAmount) return;
    
    const amount = parseFloat(newCostAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newCost: CostItem = {
        id: newId('cost'),
        description: newCostDescription,
        amount,
        date: new Date().toISOString()
    };

    try {
      if (isEditing && initialData?.id) {
        await addCostToItem(initialData.id, newCost);
      } else if (formData.model) {
        await addCostHistory(formData.model, newCostDescription, amount);
      }

      setFormData(prev => ({ ...prev, costs: [...(prev.costs || []), newCost] }));
      setNewCostDescription('');
      setNewCostAmount('');
      setIsAddCostOpen(false);
      toast.success('Custo adicionado.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível adicionar o custo.');
    }
  };

  const confirmAddPartCost = async () => {
    if (!isEditingPreparation || !initialData?.id) {
      toast.error('Adicionar peça está disponível apenas para aparelhos em preparação.');
      return;
    }
    if (!selectedPartId) {
      toast.error('Selecione uma peça.');
      return;
    }

    const quantity = Number(partUsageQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    const selectedPart = partsInventory.find((part) => part.id === selectedPartId);
    if (!selectedPart) {
      toast.error('Peça selecionada não encontrada.');
      return;
    }
    if (quantity > selectedPart.quantity) {
      toast.error('Quantidade maior que o estoque disponível da peça.');
      return;
    }

    try {
      const generatedCost = await addPartCostToItem(initialData.id, selectedPartId, quantity);
      setFormData((prev) => ({ ...prev, costs: [...(prev.costs || []), generatedCost] }));
      setSelectedPartId('');
      setPartUsageQuantity('1');
      setIsAddPartOpen(false);
      toast.success('Peça adicionada ao custo do aparelho.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível adicionar peça ao aparelho.');
    }
  };

  const handleIMEILookup = async () => {
    const rawIdentifier = (formData.imei || '').trim();
    const digits = rawIdentifier.replace(/\D/g, '');
    const isOnlyDigits = rawIdentifier.length > 0 && digits.length === rawIdentifier.length;
    const supportsLookup = formData.type === DeviceType.IPHONE || formData.type === DeviceType.IPAD;

    if (!supportsLookup || !isOnlyDigits || digits.length < 8) {
      toast.error('Busca automática disponível apenas para IMEI numérico (iPhone/iPad).');
      return;
    }

    setIsLoadingIMEI(true);
    try {
        const response = await axios.get('https://kelpom-imei-checker1.p.rapidapi.com/api', {
            params: { imei: digits },
            headers: {
                'X-RapidAPI-Key': import.meta.env.VITE_RAPID_API_KEY,
                'X-RapidAPI-Host': 'kelpom-imei-checker1.p.rapidapi.com'
            }
        });

        if (response.data && !response.data.error) {
            console.log('IMEI API Response:', response.data);
            const apiModel = response.data.model || '';
            const apiDescription = response.data.description || '';
            const fullText = `${apiModel} ${apiDescription}`.toLowerCase();

            // 1. Detect Device Type
            let detectedType = DeviceType.IPHONE;
            if (fullText.includes('ipad')) detectedType = DeviceType.IPAD;
            else if (fullText.includes('watch')) detectedType = DeviceType.WATCH;
            else if (fullText.includes('macbook')) detectedType = DeviceType.MACBOOK;

            // 2. Find Best Model Match
            const allModels = Array.from(new Set([
              ...Object.values(APPLE_MODELS).flat(),
              ...deviceCatalog.map(entry => entry.model)
            ]));
            const foundModel = allModels.find(m => fullText.includes(m.toLowerCase()));

            // 3. Extract Capacity
            const capacityMatch = fullText.match(/(\d+)\s*(gb|tb)/i);
            const foundCapacity = capacityMatch ? capacityMatch[0].toUpperCase().replace('GB', ' GB').replace('TB', ' TB') : null;

            // 4. Extract Color
            let foundColor = null;
            if (foundModel) {
                const modelColors = MODEL_COLORS[foundModel] || [];
                foundColor = modelColors.find(c => fullText.includes(c.toLowerCase()));
            }

            if (foundModel) {
                setFormData(prev => ({
                    ...prev,
                    type: detectedType,
                    model: foundModel,
                    capacity: foundCapacity || prev.capacity,
                    color: foundColor || prev.color
                }));
                toast.success(`Aparelho identificado: ${foundModel}${foundCapacity ? ' ' + foundCapacity : ''}`);
            } else {
                toast.info(`Detectado: ${apiModel}. Modelo não exato na lista.`);
                if (apiModel) setFormData(prev => ({ ...prev, type: detectedType }));
            }
        } else {
            const apiErrorMessage = response.data?.error || 'IMEI não encontrado.';
            toast.error(`Erro na API: ${apiErrorMessage}`);
        }
    } catch (error: any) {
        console.error('IMEI Error:', error);
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        if (status === 401 || status === 403) {
            toast.error('Erro de autenticação: Verifique sua chave da RapidAPI.');
        } else if (status === 429) {
            toast.error('Limite de requisições excedido na RapidAPI.');
        } else {
            toast.error(`Falha na consulta: ${message}`);
        }
    } finally {
        setIsLoadingIMEI(false);
    }
  };

  const openNewDeviceModal = () => {
    setNewDeviceForm({
      type: formData.type || DeviceType.IPHONE,
      model: '',
      color: ''
    });
    setIsNewDeviceModalOpen(true);
  };

  const handleSaveNewDevice = async () => {
    const model = newDeviceForm.model.trim();
    const color = newDeviceForm.color.trim();

    if (!model) {
      toast.error('Informe o modelo do dispositivo.');
      return;
    }

    setIsSavingNewDevice(true);
    try {
      const savedDevice = await addDeviceCatalogItem({
        type: newDeviceForm.type,
        model,
        color
      });

      setFormData(prev => ({
        ...prev,
        type: savedDevice.type,
        model: savedDevice.model,
        color: savedDevice.color || prev.color || ''
      }));

      setIsNewDeviceModalOpen(false);
      toast.success('Dispositivo criado e selecionado.');
    } catch (error: any) {
      toast.error('Erro ao salvar dispositivo: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSavingNewDevice(false);
    }
  };

  // --- Render Helpers ---

  const renderTabTrigger = (id: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
        activeTab === id 
          ? 'border-brand-500 text-brand-600 font-medium' 
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-surface-dark-500 dark:hover:text-surface-dark-400'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const handleDeleteClick = async () => {
    if (!onDelete) return;

    const confirmed = window.confirm(
      `Deseja realmente excluir o aparelho "${formData.model || 'Sem modelo'}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      await onDelete();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível excluir o aparelho.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Aparelho' : 'Novo Aparelho'}
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
            <div>
                {isEditing && onDelete && (
                    <button 
                        type="button"
                        onClick={() => {
                            void handleDeleteClick();
                        }}
                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                    >
                        <Trash2 size={16} /> Excluir
                    </button>
                )}

            </div>

            <div className="flex gap-2">
                <button onClick={onClose} className="ios-button-secondary">Cancelar</button>
                {activeTab !== 'financial' ? (
                    <button 
                        onClick={() => setActiveTab(activeTab === 'info' ? 'condition' : 'financial')} 
                        className="ios-button-primary flex items-center gap-1"
                    >
                        Próximo <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        onClick={handleSaveClick}
                        disabled={isUploading}
                        className={`ios-button-primary ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {isUploading ? 'Enviando fotos...' : isEditing ? 'Salvar Alterações' : 'Concluir Cadastro'}
                    </button>
                )}
            </div>
        </div>
      }
    >
      <div className="flex border-b border-gray-200 dark:border-surface-dark-200 mb-6">
        {renderTabTrigger('info', 'Ficha Técnica', <Smartphone size={18} />)}
        {renderTabTrigger('condition', 'Estado e Fotos', <Camera size={18} />)}
        {renderTabTrigger('financial', 'Financeiro', <DollarSign size={18} />)}
      </div>

      <div className="space-y-6 h-[60vh] overflow-y-auto pr-2">
        
        {/* TAB 1: INFO */}
        {activeTab === 'info' && (
          <div className="space-y-6 animate-ios-fade">
            <div>
              <label className="ios-label">Tipo de Dispositivo</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.values(DeviceType).map(type => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, type })}
                    className={`p-3 rounded-ios-lg border flex flex-col items-center gap-2 transition-all ${
                        formData.type === type 
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600' 
                        : 'border-gray-200 dark:border-surface-dark-300 hover:border-brand-300'
                    }`}
                  >
                    <span className="text-xs font-medium text-center">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="ios-label">Loja</label>
              <select
                className="ios-input"
                value={formData.storeId || ''}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
              >
                <option value="">Selecione a loja...</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="ios-label mb-0">Modelo</label>
                        <button
                            type="button"
                            onClick={openNewDeviceModal}
                            className="text-brand-500 text-xs font-semibold hover:underline"
                        >
                            Novo dispositivo
                        </button>
                    </div>
                    <Combobox
                        placeholder="Selecione o modelo..."
                        value={formData.model || ''}
                        onChange={(val) => setFormData({ ...formData, model: val })}
                        options={currentModels.map(m => ({ id: m, label: m }))}
                        onAddNew={openNewDeviceModal}
                        addNewLabel="Novo dispositivo"
                    />
                </div>
                <div>
                     <label className="ios-label">Cor</label>
                     {!formData.model ? (
                        <div className="text-sm text-gray-500 italic p-2 border border-dashed rounded-ios">
                            Selecione o modelo primeiro
                        </div>
                     ) : (
                        <div className="flex flex-wrap gap-2">
                            {currentModelColors.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setFormData({ ...formData, color })}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                        formData.color === color
                                        ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 dark:bg-surface-dark-200 dark:text-gray-300 dark:border-surface-dark-300'
                                    }`}
                                >
                                    {color}
                                </button>
                            ))}
                            {currentModelColors.length === 0 && (
                                <p className="text-sm text-gray-400 italic">Cores não definidas para este modelo.</p>
                            )}
                        </div>
                     )}
                </div>
            </div>

            {formData.type !== DeviceType.ACCESSORY && (
                <div>
                    <label className="ios-label">Capacidade</label>
                    <div className="flex flex-wrap gap-2">
                        {CAPACITIES.map(cap => (
                            <button
                                key={cap}
                                onClick={() => setFormData({ ...formData, capacity: cap })}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                    formData.capacity === cap
                                    ? 'bg-brand-500 text-white shadow-md'
                                    : 'bg-gray-100 dark:bg-surface-dark-200 text-gray-600 dark:text-surface-dark-500 hover:bg-gray-200'
                                }`}
                            >
                                {cap}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="ios-label">Identificação (IMEI/SERIAL)</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="ios-input font-mono flex-1"
                            placeholder="Ex: 3569... ou C02..."
                            value={formData.imei}
                            onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={handleIMEILookup}
                            disabled={isLoadingIMEI || !canLookupByImei}
                            className="px-3 rounded-ios-lg bg-gray-100 dark:bg-surface-dark-200 border border-gray-200 dark:border-surface-dark-300 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-dark-300 disabled:opacity-50 transition-colors"
                            title={
                              canLookupByImei
                                ? 'Buscar informações pelo IMEI'
                                : 'Busca automática: apenas IMEI numérico (iPhone/iPad)'
                            }
                        >
                            {isLoadingIMEI ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Informe IMEI ou Serial. A lupa só funciona com IMEI numérico (iPhone/iPad) para preencher o modelo.
                    </p>
                </div>

                {supportsImeiLookup && (
                    <div>
                        <label className="ios-label">Tipo de Chip</label>
                        <div className="flex bg-gray-100 dark:bg-surface-dark-200 p-1 rounded-ios-lg">
                            {['Physical', 'Virtual', 'Both'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, simType: type as any })}
                                    className={`flex-1 py-2 text-xs font-medium rounded-ios transition-all ${
                                        (formData.simType || 'Physical') === type
                                        ? 'bg-white dark:bg-surface-dark-100 shadow-sm text-brand-600'
                                        : 'text-gray-500'
                                    }`}
                                >
                                    {type === 'Physical' ? 'Chip Físico' : type === 'Virtual' ? 'Chip Virtual' : 'Físico + Virtual'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        {/* TAB 2: CONDITION & PHOTOS */}
        {activeTab === 'condition' && (
            <div className="space-y-6 animate-ios-fade">
                <div className="bg-gray-50 dark:bg-surface-dark-200 p-4 rounded-ios-xl">
                    <label className="ios-label mb-3">Condição do Aparelho</label>
                    <div className="flex gap-4">
                        {Object.values(Condition).map(c => (
                            <label key={c} className="flex-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="condition" 
                                    className="peer hidden" 
                                    checked={formData.condition === c}
                                    onChange={() => setFormData({ ...formData, condition: c })}
                                />
                                <div className="p-4 rounded-ios-lg border-2 border-transparent bg-white dark:bg-surface-dark-100 text-center transition-all peer-checked:border-brand-500 peer-checked:shadow-sm">
                                    <span className="font-semibold block mb-1">{c}</span>
                                    <span className="text-xs text-gray-500">
                                        {c === Condition.NEW ? 'Lacrado na caixa' : 'Com marcas de uso'}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {formData.condition === Condition.USED && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <label className="ios-label flex items-center gap-2">
                                <Battery size={16} className={batteryHealthStatus.iconClass} />
                                Saúde da Bateria
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={BATTERY_HEALTH_MIN}
                                    max={BATTERY_HEALTH_MAX}
                                    step={1}
                                    inputMode="numeric"
                                    aria-label="Saúde da bateria em porcentagem"
                                    className="ios-input w-24 text-right font-bold text-lg tabular-nums"
                                    placeholder="100"
                                    value={formData.batteryHealth ?? ''}
                                    onChange={handleBatteryHealthChange}
                                    onBlur={handleBatteryHealthBlur}
                                />
                                <span className="font-bold text-lg text-gray-600 dark:text-surface-dark-500">%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs px-1">
                            <span className={batteryHealthStatus.colorClass}>{batteryHealthStatus.label}</span>
                            <span className="text-gray-400">Manutenção abaixo de 80%</span>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="ios-label">Tem caixa?</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, hasBox: true })}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-ios-lg border transition-colors ${
                                formData.hasBox
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-surface-dark-100 text-gray-600 dark:text-surface-dark-500 border-gray-200 dark:border-surface-dark-300'
                            }`}
                        >
                            Sim
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, hasBox: false })}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-ios-lg border transition-colors ${
                                formData.hasBox === false
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-surface-dark-100 text-gray-600 dark:text-surface-dark-500 border-gray-200 dark:border-surface-dark-300'
                            }`}
                        >
                            Não
                        </button>
                    </div>
                </div>

                <div>
                    <label className="ios-label">Observações</label>
                    <textarea
                        className="ios-input min-h-[96px] resize-y"
                        value={formData.observations || ''}
                        onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                        placeholder="Ex: trocar tela e voltar bateria"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <label className="ios-label flex items-center gap-2 mb-0">
                            <Camera size={18} /> Galeria de Fotos
                        </label>
                        <span className="text-xs font-medium text-gray-500 dark:text-surface-dark-500">
                            {totalPhotoCount}/{MAX_STOCK_PHOTOS}
                        </span>
                    </div>

                    {isCameraCaptureMode && (
                      <div className="mb-3 rounded-ios-lg border border-brand-200 dark:border-brand-800 bg-brand-50/70 dark:bg-brand-900/20 px-3 py-2 flex items-center justify-between gap-3">
                        <p className="text-xs text-brand-700 dark:text-brand-200">
                          Captura contínua ativa. Se a câmera não reabrir automaticamente, toque em continuar captura.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isUploading || isPhotoLimitReached) return;
                              openCameraPicker();
                            }}
                            className="text-xs font-semibold text-brand-700 dark:text-brand-200 hover:underline whitespace-nowrap"
                          >
                            Continuar captura
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCameraCaptureMode(false)}
                            className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline whitespace-nowrap"
                          >
                            Parar
                          </button>
                        </div>
                      </div>
                    )}

                    {localPhotoQueue.length > 0 && (
                      <div className="mb-4 rounded-ios-xl border border-gray-200 dark:border-surface-dark-300 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">Fila local</p>
                          <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                            {queuedPendingCount} pendente(s) · {queuedFailedCount} falha(s)
                          </p>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {localPhotoQueue.map((photo, idx) => (
                            <div
                              key={photo.id}
                              className="aspect-square relative rounded-ios-lg overflow-hidden border border-gray-200 dark:border-surface-dark-300 bg-black/5"
                            >
                              <img src={photo.previewUrl} className="w-full h-full object-cover" alt={`Fila local ${idx + 1}`} />
                              <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white px-1.5 py-1 text-[10px] leading-tight">
                                {photo.status === 'uploading' ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 size={10} className="animate-spin" />
                                    Enviando...
                                  </span>
                                ) : photo.status === 'failed' ? (
                                  <span className="text-red-200">Falhou</span>
                                ) : (
                                  <span>Pendente</span>
                                )}
                              </div>
                              {photo.isCover && (
                                <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/65 text-white text-[10px] px-2 py-0.5">
                                  <Star size={10} />
                                  Capa
                                </span>
                              )}
                              <div className="absolute top-1 right-1 flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => removeQueuedPhoto(photo.id)}
                                  className="bg-black/60 text-white p-1 rounded-full"
                                  aria-label={`Remover foto local ${idx + 1}`}
                                >
                                  <X size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQueuedPhotoAsCover(photo.id)}
                                  className="bg-black/60 text-white p-1 rounded-full"
                                  aria-label={`Definir foto local ${idx + 1} como capa`}
                                >
                                  <Star size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveQueuedPhoto(photo.id, -1)}
                                  disabled={idx === 0}
                                  className="bg-black/60 text-white p-1 rounded-full disabled:opacity-40"
                                  aria-label={`Mover foto local ${idx + 1} para cima`}
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveQueuedPhoto(photo.id, 1)}
                                  disabled={idx === localPhotoQueue.length - 1}
                                  className="bg-black/60 text-white p-1 rounded-full disabled:opacity-40"
                                  aria-label={`Mover foto local ${idx + 1} para baixo`}
                                >
                                  <ArrowDown size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void uploadQueuedPhotos('manual')}
                            disabled={isUploading || (!hasQueuedPending && !hasQueuedFailed)}
                            className="ios-button-primary text-xs"
                          >
                            {isUploading ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Enviando...
                              </span>
                            ) : (
                              `Enviar fotos (${queuedPendingCount + queuedFailedCount})`
                            )}
                          </button>
                          {hasQueuedFailed && !isUploading && (
                            <button
                              type="button"
                              onClick={() => void uploadQueuedPhotos('manual')}
                              className="ios-button-secondary text-xs inline-flex items-center gap-1"
                            >
                              <RotateCcw size={13} />
                              Tentar novamente
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {uploadedPhotos.map((photo, idx) => (
                            <div key={`${photo}-${idx}`} className="aspect-square relative rounded-ios-lg overflow-hidden group border border-gray-200 dark:border-surface-dark-300">
                                <img src={photo} className="w-full h-full object-cover" alt={`Foto enviada ${idx + 1}`} />
                                {idx === 0 && (
                                  <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/65 text-white text-[10px] px-2 py-0.5">
                                    <Star size={10} />
                                    Capa
                                  </span>
                                )}
                                <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => removeUploadedPhoto(idx)}
                                    className="bg-black/55 text-white p-1 rounded-full"
                                    aria-label={`Remover foto enviada ${idx + 1}`}
                                  >
                                    <X size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setUploadedPhotoAsCover(idx)}
                                    className="bg-black/55 text-white p-1 rounded-full"
                                    aria-label={`Definir foto enviada ${idx + 1} como capa`}
                                  >
                                    <Star size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveUploadedPhoto(idx, -1)}
                                    disabled={idx === 0}
                                    className="bg-black/55 text-white p-1 rounded-full disabled:opacity-40"
                                    aria-label={`Mover foto enviada ${idx + 1} para cima`}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveUploadedPhoto(idx, 1)}
                                    disabled={idx === uploadedPhotos.length - 1}
                                    className="bg-black/55 text-white p-1 rounded-full disabled:opacity-40"
                                    aria-label={`Mover foto enviada ${idx + 1} para baixo`}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setIsPhotoSourceModalOpen(true)}
                            disabled={isUploading || isPhotoLimitReached}
                            className={`aspect-square rounded-ios-lg border-2 border-dashed border-gray-300 dark:border-surface-dark-300 flex flex-col items-center justify-center transition-colors text-gray-400 ${
                              isUploading || isPhotoLimitReached
                                ? 'bg-gray-100 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark-200 hover:border-brand-400'
                            }`}
                        >
                            {isUploading ? (
                              <Loader2 size={24} className="animate-spin" />
                            ) : (
                              <>
                                <Plus size={24} className="mb-1" />
                                <span className="text-xs">{isPhotoLimitReached ? 'Limite' : 'Adicionar'}</span>
                              </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* TAB 3: FINANCIALS */}
        {activeTab === 'financial' && (
            <div className="space-y-6 animate-ios-fade">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="stock-purchase-price" className="ios-label">Custo de Aquisição (R$)</label>
                        <input 
                            id="stock-purchase-price"
                            type="text"
                            inputMode="numeric"
                            className="ios-input text-lg font-medium"
                            placeholder="R$ 0,00"
                            value={formatCurrencyBRL(formData.purchasePrice)}
                            onChange={handleMoneyChange('purchasePrice')}
                        />
                    </div>
                    <div>
                        <label htmlFor="stock-sell-price" className="ios-label text-brand-600">Preço de Venda (R$)</label>
                        <input 
                            id="stock-sell-price"
                            type="text"
                            inputMode="numeric"
                            className="ios-input text-lg font-bold text-brand-600"
                            placeholder="R$ 0,00"
                            value={formatCurrencyBRL(formData.sellPrice)}
                            onChange={handleMoneyChange('sellPrice')}
                        />
                    </div>
                </div>

                <div className="ios-card p-4 bg-gray-50 dark:bg-surface-dark-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="ios-label flex items-center gap-2 mb-0">
                            <Wrench size={16} /> Custos de Reparo / Preparação
                        </label>
                        <div className="flex items-center gap-3">
                            <button 
                                type="button" 
                                onClick={() => {
                                  setIsAddCostOpen(!isAddCostOpen);
                                  if (isAddPartOpen) setIsAddPartOpen(false);
                                }}
                                className="text-brand-500 text-sm font-medium hover:underline"
                            >
                                + Adicionar Custo
                            </button>
                            {isEditingPreparation && (
                              <button 
                                  type="button" 
                                  onClick={() => {
                                    setIsAddPartOpen(!isAddPartOpen);
                                    if (isAddCostOpen) setIsAddCostOpen(false);
                                  }}
                                  className="text-brand-500 text-sm font-medium hover:underline"
                              >
                                  + Adicionar Peça
                              </button>
                            )}
                        </div>
                    </div>

                    {isAddCostOpen && (
                        <div className="flex gap-2 mb-4 animate-ios-fade">
                             <input 
                                type="text" 
                                placeholder="Descrição (ex: Troca de Tela)" 
                                className="ios-input flex-1 text-sm"
                                value={newCostDescription}
                                onChange={(e) => setNewCostDescription(e.target.value)}
                            />
                            <input 
                                type="number" 
                                placeholder="Valor" 
                                className="ios-input w-24 text-sm"
                                value={newCostAmount}
                                onChange={(e) => setNewCostAmount(e.target.value)}
                            />
                            <button 
                                onClick={confirmAddNewCost}
                                className="ios-button-primary p-2"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    )}

                    {isAddPartOpen && (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_auto] gap-2 mb-4 animate-ios-fade">
                            <select
                                className="ios-input text-sm"
                                value={selectedPartId}
                                onChange={(e) => setSelectedPartId(e.target.value)}
                            >
                                <option value="">Selecione uma peça</option>
                                {partsInventory
                                  .filter((part) => part.quantity > 0)
                                  .map((part) => (
                                    <option key={part.id} value={part.id}>
                                      {part.name} • {part.quantity} un • R$ {part.unitCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </option>
                                  ))}
                            </select>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="Qtd"
                                className="ios-input text-sm"
                                value={partUsageQuantity}
                                onChange={(e) => setPartUsageQuantity(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={confirmAddPartCost}
                                className="ios-button-primary px-3"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {(formData.costs || []).map((cost, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-surface-dark-100 p-2 rounded-ios border border-gray-200 dark:border-surface-dark-300">
                                <span className="text-sm">{cost.description}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium">R$ {cost.amount}</span>
                                    <button 
                                        onClick={() => setFormData(prev => ({ 
                                            ...prev, 
                                            costs: prev.costs?.filter((_, i) => i !== idx) 
                                        }))}
                                        className="text-red-500 hover:text-red-600"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {(formData.costs || []).length === 0 && !isAddCostOpen && (
                            <p className="text-center text-sm text-gray-400 py-2">Nenhum custo extra lançado.</p>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-surface-dark-300">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Lucro Estimado</span>
                        <span className={`text-xl font-bold ${(formData.sellPrice || 0) - (formData.purchasePrice || 0) - (formData.costs?.reduce((a, b) => a + b.amount, 0) || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            R$ {((formData.sellPrice || 0) - (formData.purchasePrice || 0) - (formData.costs?.reduce((a, b) => a + b.amount, 0) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {isEditing && (
                  <div>
                     <label className="ios-label">Status Inicial</label>
                     <div className="flex bg-gray-100 dark:bg-surface-dark-200 p-1 rounded-ios-lg">
                          {[StockStatus.AVAILABLE, StockStatus.PREPARATION].map(status => (
                              <button
                                  key={status}
                                  onClick={() => setFormData({ ...formData, status })}
                                  className={`flex-1 py-2 text-sm font-medium rounded-ios transition-all ${
                                      formData.status === status
                                      ? 'bg-white dark:bg-surface-dark-100 shadow-sm text-brand-600'
                                      : 'text-gray-500'
                                  }`}
                              >
                                  {status === StockStatus.AVAILABLE ? 'Disponível para Venda' : 'Em Preparação'}
                              </button>
                          ))}
                     </div>
                  </div>
                )}
            </div>
        )}

      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={isUploading || isPhotoLimitReached}
        onChange={(e) => void handlePhotoUpload(e, 'camera')}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={isUploading || isPhotoLimitReached}
        onChange={(e) => void handlePhotoUpload(e, 'gallery')}
      />
      
      <Modal
        open={isNewDeviceModalOpen}
        onClose={() => setIsNewDeviceModalOpen(false)}
        title="Novo Dispositivo"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewDeviceModalOpen(false)}
              className="ios-button-secondary"
              disabled={isSavingNewDevice}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveNewDevice}
              className="ios-button-primary"
              disabled={isSavingNewDevice}
            >
              {isSavingNewDevice ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Tipo</label>
            <select
              className="ios-input"
              value={newDeviceForm.type}
              onChange={(e) => setNewDeviceForm(prev => ({ ...prev, type: e.target.value as DeviceType }))}
            >
              {Object.values(DeviceType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="ios-label">Modelo</label>
            <input
              type="text"
              className="ios-input"
              value={newDeviceForm.model}
              onChange={(e) => setNewDeviceForm(prev => ({ ...prev, model: e.target.value }))}
              placeholder="Ex: StarLink Mini"
            />
          </div>
          <div>
            <label className="ios-label">Cor (opcional)</label>
            <input
              type="text"
              className="ios-input"
              value={newDeviceForm.color}
              onChange={(e) => setNewDeviceForm(prev => ({ ...prev, color: e.target.value }))}
              placeholder="Ex: Branco"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={isPhotoSourceModalOpen}
        onClose={() => setIsPhotoSourceModalOpen(false)}
        title="Adicionar Fotos"
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsPhotoSourceModalOpen(false)}
              className="ios-button-secondary"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              if (isUploading || isPhotoLimitReached) return;
              setIsPhotoSourceModalOpen(false);
              setIsCameraCaptureMode(isIOS);
              openCameraPicker();
            }}
            disabled={isUploading || isPhotoLimitReached}
            className="w-full p-4 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors flex items-center gap-3 disabled:opacity-50"
          >
            <Camera size={20} className="text-brand-500" />
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-white">Abrir câmera</p>
              <p className="text-xs text-gray-500">Captura contínua no mobile</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isUploading || isPhotoLimitReached) return;
              setIsPhotoSourceModalOpen(false);
              setIsCameraCaptureMode(false);
              galleryInputRef.current?.click();
            }}
            disabled={isUploading || isPhotoLimitReached}
            className="w-full p-4 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors flex items-center gap-3 disabled:opacity-50"
          >
            <ImageIcon size={20} className="text-brand-500" />
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-white">{galleryOptionLabel}</p>
              <p className="text-xs text-gray-500">Selecionar imagens existentes</p>
            </div>
          </button>
        </div>
      </Modal>

      {showStatusPrompt && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-surface-dark-100 rounded-ios-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Aparelho Seminovo</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Em qual status este aparelho entrará no estoque?
                    </p>
                </div>
                
                <div className="flex flex-col gap-3 p-6 pt-0">
                    <button 
                        onClick={() => performSave(StockStatus.PREPARATION)}
                        disabled={isUploading}
                        className="flex items-center justify-between p-4 rounded-ios-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors dark:bg-orange-900/20 dark:border-orange-900/30 dark:text-orange-400"
                    >
                        <span className="font-semibold">Em Preparação</span>
                        <Wrench size={20} />
                    </button>
                    
                    <button 
                        onClick={() => performSave(StockStatus.AVAILABLE)}
                        disabled={isUploading}
                        className="flex items-center justify-between p-4 rounded-ios-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400"
                    >
                        <span className="font-semibold">Disponível para Venda</span>
                        <Tag size={20} />
                    </button>
                </div>

                <div className="bg-gray-50 dark:bg-surface-dark-200 p-3 flex justify-center border-t border-gray-100 dark:border-surface-dark-300">
                    <button 
                        onClick={() => setShowStatusPrompt(false)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-sm"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
      )}
    </Modal>
  );
};
