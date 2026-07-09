import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import Modal from './ui/Modal';
import { useData } from '../services/dataContext';
import { DeviceType, Condition, StockStatus, StockItem, CostItem } from '../types';
import { CAPACITIES } from '../constants';
import { Smartphone, Battery, Camera, DollarSign, Wrench, X, Tag, Plus, Trash2, ChevronRight, Loader2, Search, Star, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useToast } from './ui/ToastProvider';
import { uploadImage, removeImage, removeImages } from '../services/storage';
import { newId } from '../utils/id';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/inputMasks';
import { Combobox } from './ui/Combobox';
import {
  MAX_DEVICE_IMAGE_SIZE_BYTES,
  MAX_STOCK_PHOTOS,
  clampFilesToPhotoLimit,
  mergeUploadedPhotosWithCover,
  moveItemInArray,
  preparePhotoForUpload,
  resolveSaveBlockReason,
} from '../utils/stockPhotoWorkflow';
import {
  buildStockItemPayload,
  clampBatteryHealth,
  createDefaultStockFormState,
  createInitialStockFormState
} from './stock-form/stockFormModel';
import { useStockPhotoQueue } from './stock-form/useStockPhotoQueue';
import {
  buildStockFormDraftKey,
  clearStockFormDraft,
  collectChangedFields,
  readStockFormDraft,
  writeStockFormDraft,
} from './stock-form/stockFormDraftStore';
import {
  getChipOptions,
  getDeviceColors,
  getDeviceModels,
  getImeiLookupState,
  resolveSelectedChipType,
  supportsDeviceCapacity,
  supportsDeviceChipSelection,
} from './stock-form/stockDeviceOptions';
import { getImeiLookupFailureMessage, resolveImeiLookupResponse } from './stock-form/stockImeiLookup';

interface StockFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: StockItem; // If provided, we are editing
  onSave?: (item: StockItem) => boolean | void;
  onDelete?: () => void | Promise<void>;
  onAddToInUse?: () => void | Promise<void>;
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

const resolveImageMimeType = (file: File) => {
  const rawType = (file.type || '').trim().toLowerCase();
  if (rawType) {
    if (rawType === 'image/jpg') return 'image/jpeg';
    return rawType;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[extension] || '';
};

export const StockFormModal: React.FC<StockFormModalProps> = ({
  open,
  onClose,
  initialData,
  onSave,
  onDelete,
  onAddToInUse,
  defaultStatus,
  draftContext,
}) => {
  const {
    addStockItem,
    updateStockItem,
    stores,
    addCostHistory,
    addCostToItem,
    partsInventory,
    addPartCostToItem,
    deviceCatalog,
    addDeviceCatalogItem
  } = useData();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<Tab>('info');
  // Indica que o formulário foi reaberto com alterações não salvas recuperadas
  // de um rascunho persistido (permite oferecer "Descartar alterações").
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const defaultState = useMemo(() => createDefaultStockFormState(stores), [stores]);
  const [formData, setFormData] = useState<Partial<StockItem>>(defaultState);

  // Estado "original" do formulário: registro em edição ou formulário em branco
  // no cadastro. É a base contra a qual o rascunho é comparado/restaurado.
  const baseFormState = useMemo<Partial<StockItem>>(
    () =>
      initialData
        ? createInitialStockFormState(stores, initialData)
        : { ...defaultState, storeId: stores.length > 0 ? stores[0].id : '' },
    [initialData, stores, defaultState]
  );

  // Cost logic
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [newCostDescription, setNewCostDescription] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partUsageQuantity, setPartUsageQuantity] = useState('1');

  const { isOpen: showStatusPrompt, open: openStatusPrompt, close: closeStatusPrompt } = useDisclosure();
  const [isLoadingIMEI, setIsLoadingIMEI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraCaptureMode, setIsCameraCaptureMode] = useState(false);
  const { isOpen: isNewDeviceModalOpen, open: openNewDeviceModal, close: closeNewDeviceModal } = useDisclosure();
  const [isSavingNewDevice, setIsSavingNewDevice] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    type: DeviceType.IPHONE as DeviceType,
    model: '',
    color: ''
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);
  const initializedSessionRef = useRef<{ isOpen: boolean; key: string | null }>({
    isOpen: false,
    key: null,
  });
  const deviceFamily = useMemo<DeviceFamily>(() => detectDeviceFamily(), []);
  const isIOS = deviceFamily === 'ios';
  const isDesktop = deviceFamily === 'desktop';
  const uploadedPhotos = formData.photos || [];
  const revokePreviewUrl = useCallback((previewUrl: string) => {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    try {
      URL.revokeObjectURL(previewUrl);
    } catch {
      // no-op
    }
  }, []);
  const {
    localPhotoQueue,
    isUploading,
    addQueuedPhotos,
    clearLocalPhotoQueue,
    replaceLocalPhotoQueue,
    removeQueuedPhoto,
    moveQueuedPhoto,
    setQueuedPhotoAsCover,
    uploadQueuedPhotos: uploadQueuedPhotosFromQueue
  } = useStockPhotoQueue({
    uploadedCount: uploadedPhotos.length,
    isMobile: !isDesktop,
    createId: newId,
    createObjectUrl: (file) => URL.createObjectURL(file),
    revokeObjectUrl: revokePreviewUrl,
    uploadImage,
    preparePhotoForUpload,
    onUploadedPhotos: (uploadedUrls, coverUploadedUrl) => {
      setFormData((prev) => ({
        ...prev,
        photos: mergeUploadedPhotosWithCover(prev.photos || [], uploadedUrls, coverUploadedUrl),
      }));
    }
  });
  const imeiLookupState = getImeiLookupState(formData.type, formData.imei);
  const canLookupByImei = imeiLookupState.canLookupByImei;
  const supportsCapacity = supportsDeviceCapacity(formData.type);
  const chipOptions = useMemo(() => getChipOptions(formData.type), [formData.type]);
  const supportsChipSelection = supportsDeviceChipSelection(formData.type);
  const selectedChipType = resolveSelectedChipType(formData.type, formData.simType);
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
  // Chave do rascunho persistido: separa cadastro novo de cada aparelho editado,
  // para que alterações sobrevivam ao fechamento do app sem misturar registros.
  const draftKey = useMemo(
    () =>
      draftContext
        ? buildStockFormDraftKey(draftContext, isEditing ? 'edit' : 'new', initialData?.id)
        : null,
    [draftContext, isEditing, initialData?.id]
  );
  const formSessionKey = draftKey ?? (isEditing ? `edit:${initialData?.id ?? ''}` : 'new');
  const isSaveBusy = isUploading || isSaving;
  const isPdvTradeInDraft = draftContext === 'pdv-tradein' && !isEditing;
  const isEditingPreparation = isEditing && (initialData?.status === StockStatus.PREPARATION || formData.status === StockStatus.PREPARATION);
  const currentModels = useMemo(
    () => getDeviceModels(formData.type, deviceCatalog),
    [formData.type, deviceCatalog]
  );

  const currentModelColors = useMemo(
    () => getDeviceColors(formData.type, formData.model, deviceCatalog),
    [formData.model, formData.type, deviceCatalog]
  );

  const openCameraPicker = useCallback(() => {
    const input = cameraInputRef.current;
    if (!input) return;

    // No iOS/Safari (especialmente em PWA standalone), `showPicker()` NÃO abre a
    // câmera de um input com `capture` de forma confiável: ele é chamado, não
    // lança erro e não abre nada — o que fazia a câmera "nunca aparecer".
    // `.click()` é o método universalmente suportado que respeita `capture`.
    input.click();
  }, []);

  // Abre DIRETO o seletor nativo do sistema — sem modais intermediários. No
  // iOS, um input `accept="image/*"` sem `capture` mostra o action sheet
  // nativo (Fototeca / Tirar Foto ou Gravar Vídeo / Escolher Arquivos), então
  // um único toque já cobre galeria, câmera e arquivos. O prompt de permissão
  // de câmera, quando necessário, é exibido pelo próprio iOS.
  const requestPhotoSource = useCallback((source: PhotoInputSource) => {
    if (isUploading || isPhotoLimitReached) return;

    if (source === 'camera') {
      setIsCameraCaptureMode(isIOS);
      openCameraPicker();
      return;
    }

    setIsCameraCaptureMode(false);
    galleryInputRef.current?.click();
  }, [isIOS, isPhotoLimitReached, isUploading, openCameraPicker]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    clearStockFormDraft(draftKey);
    setHasRestoredDraft(false);
  }, [draftKey]);

  // Descarta as alterações não salvas recuperadas e volta o formulário ao
  // estado original (registro em edição) ou ao formulário em branco (cadastro).
  const handleDiscardDraft = useCallback(() => {
    // Fotos enviadas ao storage nesta sessão que NÃO pertencem ao registro
    // original (ou, no cadastro novo, nenhuma foi persistida ainda). Como o
    // rascunho será apagado, elas deixam de ser referenciadas e viram órfãs —
    // então removemos do storage (best-effort). No Cancelar isso NÃO ocorre,
    // pois o rascunho é mantido e ainda referencia essas imagens.
    const originalPhotos = initialData?.photos || [];
    const sessionUploadedPhotos = (formData.photos || []).filter(
      (url) => !originalPhotos.includes(url)
    );
    if (sessionUploadedPhotos.length > 0) {
      void removeImages(sessionUploadedPhotos, 'device-images');
    }

    setFormData(baseFormState);
    clearLocalPhotoQueue();
    setIsCameraCaptureMode(false);
    setActiveTab('info');
    clearDraft();
  }, [initialData, formData.photos, baseFormState, clearLocalPhotoQueue, clearDraft]);
  
  useEffect(() => {
    if (!open) {
      initializedSessionRef.current = { isOpen: false, key: formSessionKey };
      return;
    }

    const shouldInitialize =
      !initializedSessionRef.current.isOpen ||
      initializedSessionRef.current.key !== formSessionKey;
    if (!shouldInitialize) return;

    initializedSessionRef.current = { isOpen: true, key: formSessionKey };
    setIsAddCostOpen(false);
    setIsAddPartOpen(false);
    setSelectedPartId('');
    setPartUsageQuantity('1');
    closeStatusPrompt();

    const savedDraft = draftKey ? readStockFormDraft(draftKey) : null;
    // Restaura o rascunho aplicando APENAS os campos que o usuário alterou em
    // relação à base de quando o rascunho foi salvo. Assim, campos que o
    // usuário não tocou seguem o valor atual do registro (não sobrescrevemos
    // dados que mudaram desde então) e um rascunho idêntico à base (ex.:
    // formulário aberto e fechado sem edição) não dispara a recuperação.
    const changedFields = savedDraft
      ? collectChangedFields(savedDraft.formData, savedDraft.baseFormData ?? baseFormState)
      : null;
    const draftDiffers = !!changedFields && Object.keys(changedFields).length > 0;

    if (savedDraft && draftDiffers) {
      setFormData({ ...baseFormState, ...changedFields });
      replaceLocalPhotoQueue(savedDraft.localPhotoQueue);
      setIsCameraCaptureMode(savedDraft.isCameraCaptureMode);
      setActiveTab(savedDraft.activeTab);
      setHasRestoredDraft(true);
    } else {
      setFormData(baseFormState);
      clearLocalPhotoQueue();
      setIsCameraCaptureMode(false);
      setActiveTab('info');
      setHasRestoredDraft(false);
    }
  }, [open, baseFormState, draftKey, formSessionKey, clearLocalPhotoQueue, replaceLocalPhotoQueue]);

  useEffect(() => {
    if (!open) {
      setIsCameraCaptureMode(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !draftKey) return;

    writeStockFormDraft(draftKey, {
      formData,
      baseFormData: baseFormState,
      activeTab,
      localPhotoQueue,
      isCameraCaptureMode,
    });
  }, [open, draftKey, formData, activeTab, localPhotoQueue, isCameraCaptureMode, baseFormState]);

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
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    const itemData = buildStockItemPayload({
      formData,
      statusOverride,
      stores,
      supportsCapacity,
      selectedChipType
    });

    try {
      if (isEditing && initialData?.id) {
        await updateStockItem(initialData.id, itemData);
        toast.success('Aparelho atualizado com sucesso!');
      } else if (isPdvTradeInDraft) {
        if (onSave?.(itemData) === false) {
          return;
        }
        toast.success('Trade-in adicionado ao rascunho da venda.');
      } else {
        await addStockItem(itemData);
        toast.success('Aparelho cadastrado com sucesso!');
      }

      clearDraft();
      clearLocalPhotoQueue();
      closeStatusPrompt();
      setIsCameraCaptureMode(false);
      if (!isPdvTradeInDraft) onSave?.(itemData);
      onClose();
    } catch (error: any) {
      toast.error('Erro ao salvar aparelho: ' + (error.message || 'Erro desconhecido'));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const removeUploadedPhoto = (index: number) => {
    const photos = formData.photos || [];
    const removedUrl = photos[index];

    setFormData((prev) => {
      const prevPhotos = prev.photos || [];
      if (index < 0 || index >= prevPhotos.length) return prev;
      return {
        ...prev,
        photos: prevPhotos.filter((_, idx) => idx !== index),
      };
    });

    // Apaga do storage apenas fotos enviadas nesta sessão (ainda não
    // persistidas no registro original). Fotos que já existiam no item
    // (initialData) são reconciliadas em updateStockItem ao salvar, evitando
    // remover do storage uma imagem que continua referenciada caso o usuário
    // cancele a edição.
    const wasAlreadyPersisted = (initialData?.photos || []).includes(removedUrl);
    if (removedUrl && !wasAlreadyPersisted) {
      void removeImage(removedUrl, 'device-images');
    }
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

  const uploadQueuedPhotos = async (trigger: 'manual' | 'save') => {
    const uploadTargetsCount = localPhotoQueue.filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    ).length;

    if (uploadTargetsCount === 0) {
      if (trigger === 'manual') {
        toast.info('Não há fotos pendentes para enviar.');
      }
      return { successCount: 0, failedCount: 0 };
    }

    const result = await uploadQueuedPhotosFromQueue();

    if (result.successCount > 0) {
      toast.success(`${result.successCount} foto(s) enviada(s) com sucesso.`);
    }

    if (result.failedCount > 0) {
      toast.error(
        `${result.failedCount} foto(s) falharam no upload. Corrija e toque em \"Tentar novamente\".`
      );
    }

    return result;
  };

  const handleSaveClick = async () => {
    if (isSaveBusy) return;

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
      openStatusPrompt();
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

    addQueuedPhotos(acceptedFiles, source);

    if (isCameraInput && isCameraCaptureMode && isIOS) {
      const totalAfterSelection = uploadedPhotos.length + localPhotoQueue.length + acceptedFiles.length;
      if (totalAfterSelection >= MAX_STOCK_PHOTOS) {
        // Atingiu o limite: encerra o modo de captura contínua.
        setIsCameraCaptureMode(false);
        toast.info(`Limite de ${MAX_STOCK_PHOTOS} fotos atingido.`);
      }
      // Abaixo do limite: mantém o modo ativo e o botão "Tirar outra foto".
      // NÃO reabrimos a câmera automaticamente: no iOS isso exige um novo gesto
      // do usuário (user activation), então o reabrir programático não funciona.
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
    const lookupState = getImeiLookupState(formData.type, formData.imei);

    if (!lookupState.canLookupByImei) {
      toast.error('Busca automática disponível apenas para IMEI numérico (iPhone/iPad).');
      return;
    }

    setIsLoadingIMEI(true);
    try {
        const response = await axios.get('https://kelpom-imei-checker1.p.rapidapi.com/api', {
            params: { imei: lookupState.digits },
            headers: {
                'X-RapidAPI-Key': import.meta.env.VITE_RAPID_API_KEY,
                'X-RapidAPI-Host': 'kelpom-imei-checker1.p.rapidapi.com'
            }
        });

        const resolution = resolveImeiLookupResponse(response.data, deviceCatalog);

        if (resolution.kind === 'identified') {
            setFormData(prev => ({
                ...prev,
                type: resolution.detectedType,
                model: resolution.model,
                capacity: resolution.capacity || prev.capacity,
                color: resolution.color || prev.color
            }));
            toast.success(`Aparelho identificado: ${resolution.model}${resolution.capacity ? ' ' + resolution.capacity : ''}`);
        } else if (resolution.kind === 'unmatched') {
            toast.info(`Detectado: ${resolution.apiModel}. Modelo não exato na lista.`);
            if (resolution.apiModel) setFormData(prev => ({ ...prev, type: resolution.detectedType }));
        } else {
            toast.error(`Erro na API: ${resolution.message}`);
        }
    } catch (error: any) {
        console.error('IMEI Error:', error);
        toast.error(getImeiLookupFailureMessage(error));
    } finally {
        setIsLoadingIMEI(false);
    }
  };

  const handleOpenNewDeviceModal = () => {
    setNewDeviceForm({
      type: formData.type || DeviceType.IPHONE,
      model: '',
      color: ''
    });
    openNewDeviceModal();
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

      closeNewDeviceModal();
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

    const confirmed = await toast.confirm({
      title: 'Excluir aparelho',
      description: `Excluir o aparelho "${formData.model || 'Sem modelo'}" removerá o registro do estoque. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir aparelho',
      variant: 'danger',
    });

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
            <div className="flex flex-wrap items-center gap-3">
                {isEditing && onDelete && (
                    <button 
                        type="button"
                        onClick={() => {
                            void handleDeleteClick();
                        }}
                        className="min-h-[44px] px-2 rounded-ios text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                    >
                        <Trash2 size={16} /> Excluir
                    </button>
                )}
                {isEditing && onAddToInUse && (
                    <button
                        type="button"
                        onClick={() => {
                            void onAddToInUse();
                        }}
                        className="min-h-[44px] px-2 rounded-ios text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"
                    >
                        <RotateCcw size={16} /> Adicionar em Uso
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
                        disabled={isSaveBusy}
                        className={`ios-button-primary ${isSaveBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {isUploading ? 'Enviando fotos...' : isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Concluir Cadastro'}
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

      <div className="space-y-6">

        {hasRestoredDraft && (
          <div className="flex items-center justify-between gap-3 rounded-ios-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <RotateCcw size={16} className="shrink-0" />
              <p className="text-xs leading-snug">
                Recuperamos as alterações que você havia feito e ainda não tinha salvado.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline whitespace-nowrap"
            >
              Descartar alterações
            </button>
          </div>
        )}

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
                            onClick={handleOpenNewDeviceModal}
                            className="-mr-2 inline-flex min-h-10 items-center rounded-ios px-2 text-xs font-semibold text-brand-500 hover:bg-brand-50 hover:no-underline dark:hover:bg-brand-900/20"
                        >
                            Novo dispositivo
                        </button>
                    </div>
                    <Combobox
                        placeholder="Selecione o modelo..."
                        value={formData.model || ''}
                        onChange={(val) => setFormData({ ...formData, model: val })}
                        options={currentModels.map(m => ({ id: m, label: m }))}
                        onAddNew={handleOpenNewDeviceModal}
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

            {supportsCapacity && (
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

                {supportsChipSelection && (
                    <div>
                        <label className="ios-label">Tipo de Chip</label>
                        <div className="flex bg-gray-100 dark:bg-surface-dark-200 p-1 rounded-ios-lg">
                            {chipOptions.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, simType: type })}
                                    className={`flex-1 py-2 text-xs font-medium rounded-ios transition-all ${
                                        selectedChipType === type
                                        ? 'bg-white dark:bg-surface-dark-100 shadow-sm text-brand-600'
                                        : 'text-gray-500'
                                    }`}
                                >
                                    {type === 'Physical' ? 'Chip Físico' : type === 'Virtual' ? 'Chip Virtual' : type === 'Both' ? 'Físico + Virtual' : 'Sem Chip'}
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
                          Captura ativa. Toque em "Tirar outra foto" para abrir a câmera novamente.
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
                            Tirar outra foto
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
                              <img src={photo.previewUrl} className="w-full h-full object-cover" alt={`Fila local ${idx + 1}`} loading="lazy" decoding="async" />
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
                                <img src={photo} className="w-full h-full object-cover" alt={`Foto enviada ${idx + 1}`} loading="lazy" decoding="async" />
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
                        {!isDesktop && (
                          <button
                              type="button"
                              onClick={() => requestPhotoSource('camera')}
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
                                  <Camera size={24} className="mb-1" />
                                  <span className="text-xs">{isPhotoLimitReached ? 'Limite' : 'Tirar foto'}</span>
                                </>
                              )}
                          </button>
                        )}
                        <button
                            type="button"
                            onClick={() => requestPhotoSource('gallery')}
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
                    <p className="mt-2 text-xs text-gray-500 dark:text-surface-dark-500">
                        A primeira foto é a capa e aparece na lista do estoque.
                    </p>
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
                                    <span className="text-sm font-medium">{formatCurrencyBRL(cost.amount)}</span>
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
        onClose={() => closeNewDeviceModal()}
        title="Novo Dispositivo"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => closeNewDeviceModal()}
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
        open={showStatusPrompt}
        onClose={closeStatusPrompt}
        title="Aparelho Seminovo"
        size="sm"
        zIndexClass="z-[60]"
        footer={
          <div className="flex justify-center">
            <button
              type="button"
              onClick={closeStatusPrompt}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-sm min-h-[44px] px-4"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Em qual status este aparelho entrará no estoque?
          </p>
          <button
            type="button"
            onClick={() => void performSave(StockStatus.PREPARATION)}
            disabled={isSaveBusy}
            className="flex items-center justify-between w-full p-4 rounded-ios-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed dark:bg-orange-900/20 dark:border-orange-900/30 dark:text-orange-400"
          >
            <span className="font-semibold">Em Preparação</span>
            <Wrench size={20} />
          </button>
          <button
            type="button"
            onClick={() => void performSave(StockStatus.AVAILABLE)}
            disabled={isSaveBusy}
            className="flex items-center justify-between w-full p-4 rounded-ios-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400"
          >
            <span className="font-semibold">Disponível para Venda</span>
            <Tag size={20} />
          </button>
        </div>
      </Modal>
    </Modal>
  );
};
