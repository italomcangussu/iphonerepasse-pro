import { DeviceType } from './types';

export const APPLE_MODELS = {
  [DeviceType.IPHONE]: [
    'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
    'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
    'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
    'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
    'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
    'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
    'iPhone XR', 'iPhone XS Max', 'iPhone XS', 'iPhone SE (3ª Ger)'
  ],
  [DeviceType.IPAD]: [
    'iPad Pro 13" (M4)', 'iPad Pro 11" (M4)',
    'iPad Air 13" (M2)', 'iPad Air 11" (M2)',
    'iPad (10ª Ger)', 'iPad mini (6ª Ger)',
    'iPad Pro 12.9" (6ª Ger)', 'iPad Pro 11" (4ª Ger)'
  ],
  [DeviceType.MACBOOK]: [
    'MacBook Pro 16" (M4 Max)', 'MacBook Pro 14" (M4 Pro)',
    'MacBook Air 15" (M3)', 'MacBook Air 13" (M3)',
    'MacBook Pro 16" (M3 Max)', 'MacBook Pro 14" (M3)',
    'MacBook Air 15" (M2)', 'MacBook Air 13" (M2)'
  ],
  [DeviceType.WATCH]: [
    'Apple Watch Ultra 2', 'Apple Watch Series 10', 'Apple Watch SE',
    'Apple Watch Series 9', 'Apple Watch Ultra'
  ],
  [DeviceType.ACCESSORY]: [
    'AirPods Pro (2ª Ger)', 'AirPods 4', 'AirPods Max', 'Carregador 20W', 'Cabo USB-C'
  ]
};

export const COLORS = [
  'Titanium Black', 'Titanium White', 'Titanium Natural', 'Titanium Desert',
  'Preto', 'Branco', 'Azul', 'Verde', 'Rosa', 'Amarelo', 
  'Meia-noite', 'Estelar', 'Roxo', 'Vermelho (PRODUCT)RED',
  'Grafite', 'Prateado', 'Dourado', 'Azul Sierra', 'Verde Alpino'
];

export const CAPACITIES = [
  '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'
];

export const COMMON_REPAIRS = [
  { description: 'Troca de Bateria', amount: 180 },
  { description: 'Troca de Tela', amount: 450 },
  { description: 'Reparo de FaceID', amount: 300 },
  { description: 'Reparo de Placa', amount: 250 },
  { description: 'Limpeza e Higienização', amount: 50 }
];