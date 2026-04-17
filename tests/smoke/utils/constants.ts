import path from 'node:path';

export const SMOKE_AUTH_DIR = path.resolve(process.cwd(), 'tests/smoke/.auth');
export const ADMIN_STORAGE_STATE = path.resolve(SMOKE_AUTH_DIR, 'admin.json');
export const SELLER_STORAGE_STATE = path.resolve(SMOKE_AUTH_DIR, 'seller.json');
