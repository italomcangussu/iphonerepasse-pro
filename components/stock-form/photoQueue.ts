import {
  ensureSingleCoverInQueue,
  mergeUploadBatchOutcome,
  moveItemInArray,
  setQueueCover,
  type LocalPhotoQueueItem,
  type UploadBatchOutcome
} from '../../utils/stockPhotoWorkflow';

export type PhotoQueueState = LocalPhotoQueueItem[];

export type PhotoQueueAction =
  | { type: 'added'; photos: LocalPhotoQueueItem[] }
  | { type: 'removed'; id: string }
  | { type: 'moved'; id: string; direction: -1 | 1 }
  | { type: 'cover-selected'; id: string }
  | { type: 'upload-started'; ids: string[] }
  | { type: 'upload-finished'; outcomes: UploadBatchOutcome[] }
  | { type: 'cleared' };

export const reducePhotoQueue = (
  state: PhotoQueueState,
  action: PhotoQueueAction
): PhotoQueueState => {
  switch (action.type) {
    case 'added':
      return ensureSingleCoverInQueue([...state, ...action.photos], state.length === 0);
    case 'removed':
      return ensureSingleCoverInQueue(state.filter((photo) => photo.id !== action.id), true);
    case 'moved': {
      const index = state.findIndex((photo) => photo.id === action.id);
      if (index === -1) return state;
      const nextIndex = index + action.direction;
      if (nextIndex < 0 || nextIndex >= state.length) return state;
      return ensureSingleCoverInQueue(moveItemInArray(state, index, nextIndex));
    }
    case 'cover-selected':
      return setQueueCover(state, action.id);
    case 'upload-started': {
      const ids = new Set(action.ids);
      return state.map((photo) => (
        ids.has(photo.id)
          ? { ...photo, status: 'uploading', error: undefined }
          : photo
      ));
    }
    case 'upload-finished':
      return ensureSingleCoverInQueue(
        mergeUploadBatchOutcome(state, action.outcomes).nextQueue,
        true
      );
    case 'cleared':
      return [];
    default:
      return state;
  }
};

export const getRemovedPreviewUrls = (
  previous: PhotoQueueState,
  next: PhotoQueueState
): string[] => {
  const nextIds = new Set(next.map((photo) => photo.id));
  return previous
    .filter((photo) => !nextIds.has(photo.id))
    .map((photo) => photo.previewUrl);
};
