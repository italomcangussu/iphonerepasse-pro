import { DeviceType } from './types';

export const APPLE_MODELS = {
  [DeviceType.IPHONE]: [
    'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17 Air', 'iPhone 17',
    'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
    'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
    'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
    'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
    'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
    'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
    'iPhone XR', 'iPhone XS Max', 'iPhone XS', 'iPhone SE (3ª Ger)'
  ],
  [DeviceType.IPAD]: [
    'iPad Pro 13" (M5)', 'iPad Pro 11" (M5)',
    'iPad Pro 13" (M4)', 'iPad Pro 11" (M4)',
    'iPad Air 13" (M3)', 'iPad Air 11" (M3)',
    'iPad Air 13" (M2)', 'iPad Air 11" (M2)',
    'iPad (11ª Ger)', 'iPad (10ª Ger)',
    'iPad mini (7ª Ger)', 'iPad mini (6ª Ger)',
    'iPad Pro 12.9" (6ª Ger)', 'iPad Pro 11" (4ª Ger)'
  ],
  [DeviceType.MACBOOK]: [
    'MacBook Pro 16" (M5 Max)', 'MacBook Pro 14" (M5 Pro)', 'MacBook Pro 14" (M5)',
    'MacBook Pro 16" (M4 Max)', 'MacBook Pro 14" (M4 Pro)',
    'MacBook Air 15" (M4)', 'MacBook Air 13" (M4)',
    'MacBook Air 15" (M3)', 'MacBook Air 13" (M3)',
    'MacBook Pro 16" (M3 Max)', 'MacBook Pro 14" (M3)',
    'MacBook Air 15" (M2)', 'MacBook Air 13" (M2)'
  ],
  [DeviceType.WATCH]: [
    'Apple Watch Ultra 3', 'Apple Watch Ultra 2', 'Apple Watch Ultra',
    'Apple Watch Series 11 (46mm)', 'Apple Watch Series 11 (42mm)',
    'Apple Watch Series 10', 'Apple Watch Series 9',
    'Apple Watch SE (3ª Ger)', 'Apple Watch SE'
  ],
  [DeviceType.ACCESSORY]: [
    'AirPods Pro 3', 'AirPods Pro (2ª Ger)', 'AirPods 4', 'AirPods Max', 'Carregador 20W', 'Cabo USB-C'
  ]
};

export const COLORS = [
  'Titanium Black', 'Titanium White', 'Titanium Natural', 'Titanium Desert',
  'Preto', 'Branco', 'Azul', 'Verde', 'Rosa', 'Amarelo', 
  'Meia-noite', 'Estelar', 'Roxo', 'Vermelho (PRODUCT)RED',
  'Grafite', 'Prateado', 'Dourado', 'Azul Sierra', 'Verde Alpino'
];

export const MODEL_COLORS: Record<string, string[]> = {
  // iPhone 17 Series
  'iPhone 17 Pro Max': ['Azul Profundo', 'Laranja Cósmico', 'Prateado'],
  'iPhone 17 Pro': ['Azul Profundo', 'Laranja Cósmico', 'Prateado'],
  'iPhone 17 Air': ['Azul Céu', 'Dourado Claro', 'Branco Nuvem', 'Preto Espacial'],
  'iPhone 17': ['Preto', 'Branco', 'Lavanda', 'Azul Bruma', 'Verde Sálvia'],

  // iPhone 16 Series
  'iPhone 16 Pro Max': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'],
  'iPhone 16 Pro': ['Titânio Preto', 'Titânio Branco', 'Titânio Natural', 'Titânio Deserto'],
  'iPhone 16 Plus': ['Ultramarino', 'Verde-azulado', 'Rosa', 'Branco', 'Preto'],
  'iPhone 16': ['Ultramarino', 'Verde-azulado', 'Rosa', 'Branco', 'Preto'],

  // iPhone 15 Series
  'iPhone 15 Pro Max': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'],
  'iPhone 15 Pro': ['Titânio Preto', 'Titânio Branco', 'Titânio Azul', 'Titânio Natural'],
  'iPhone 15 Plus': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'],
  'iPhone 15': ['Preto', 'Azul', 'Verde', 'Amarelo', 'Rosa'],

  // iPhone 14 Series
  'iPhone 14 Pro Max': ['Roxo-profundo', 'Dourado', 'Prateado', 'Preto-espacial'],
  'iPhone 14 Pro': ['Roxo-profundo', 'Dourado', 'Prateado', 'Preto-espacial'],
  'iPhone 14 Plus': ['Meia-noite', 'Estelar', 'Azul', 'Roxo', 'Vermelho (PRODUCT)RED', 'Amarelo'],
  'iPhone 14': ['Meia-noite', 'Estelar', 'Azul', 'Roxo', 'Vermelho (PRODUCT)RED', 'Amarelo'],

  // iPhone 13 Series
  'iPhone 13 Pro Max': ['Verde-alpino', 'Prateado', 'Dourado', 'Grafite', 'Azul-sierra'],
  'iPhone 13 Pro': ['Verde-alpino', 'Prateado', 'Dourado', 'Grafite', 'Azul-sierra'],
  'iPhone 13': ['Verde', 'Rosa', 'Azul', 'Meia-noite', 'Estelar', 'Vermelho (PRODUCT)RED'],
  'iPhone 13 mini': ['Verde', 'Rosa', 'Azul', 'Meia-noite', 'Estelar', 'Vermelho (PRODUCT)RED'],

  // iPhone 12 Series
  'iPhone 12 Pro Max': ['Azul-pacífico', 'Dourado', 'Grafite', 'Prateado'],
  'iPhone 12 Pro': ['Azul-pacífico', 'Dourado', 'Grafite', 'Prateado'],
  'iPhone 12': ['Roxo', 'Azul', 'Verde', 'Vermelho (PRODUCT)RED', 'Branco', 'Preto'],
  'iPhone 12 mini': ['Roxo', 'Azul', 'Verde', 'Vermelho (PRODUCT)RED', 'Branco', 'Preto'],

  // iPhone 11 Series
  'iPhone 11 Pro Max': ['Verde-meia-noite', 'Prateado', 'Cinza-espacial', 'Dourado'],
  'iPhone 11 Pro': ['Verde-meia-noite', 'Prateado', 'Cinza-espacial', 'Dourado'],
  'iPhone 11': ['Roxo', 'Amarelo', 'Verde', 'Preto', 'Branco', 'Vermelho (PRODUCT)RED'],

  // iPhone Legacy
  'iPhone SE (3ª Ger)': ['Meia-noite', 'Estelar', 'Vermelho (PRODUCT)RED'],
  'iPhone XS Max': ['Dourado', 'Cinza-espacial', 'Prateado'],
  'iPhone XS': ['Dourado', 'Cinza-espacial', 'Prateado'],
  'iPhone XR': ['Azul', 'Branco', 'Preto', 'Amarelo', 'Coral', 'Vermelho (PRODUCT)RED'],

  // iPads - Pro
  'iPad Pro 13" (M5)': ['Prateado', 'Preto Espacial'],
  'iPad Pro 11" (M5)': ['Prateado', 'Preto Espacial'],
  'iPad Pro 13" (M4)': ['Prateado', 'Preto Espacial'],
  'iPad Pro 11" (M4)': ['Prateado', 'Preto Espacial'],
  'iPad Pro 12.9" (6ª Ger)': ['Cinza-espacial', 'Prateado'],
  'iPad Pro 11" (4ª Ger)': ['Cinza-espacial', 'Prateado'],

  // iPads - Air
  'iPad Air 13" (M3)': ['Azul', 'Roxo', 'Cinza-espacial', 'Estelar'],
  'iPad Air 11" (M3)': ['Azul', 'Roxo', 'Cinza-espacial', 'Estelar'],
  'iPad Air 13" (M2)': ['Azul', 'Roxo', 'Cinza-espacial', 'Estelar'],
  'iPad Air 11" (M2)': ['Azul', 'Roxo', 'Cinza-espacial', 'Estelar'],

  // iPads - Base & Mini
  'iPad (11ª Ger)': ['Azul', 'Rosa', 'Prateado', 'Amarelo'],
  'iPad (10ª Ger)': ['Azul', 'Rosa', 'Prateado', 'Amarelo'],
  'iPad mini (7ª Ger)': ['Cinza-espacial', 'Azul', 'Roxo', 'Estelar'],
  'iPad mini (6ª Ger)': ['Cinza-espacial', 'Rosa', 'Roxo', 'Estelar'],

  // MacBooks - Air
  'MacBook Air 15" (M4)': ['Meia-noite', 'Estelar', 'Prateado', 'Azul Céu'],
  'MacBook Air 13" (M4)': ['Meia-noite', 'Estelar', 'Prateado', 'Azul Céu'],
  'MacBook Air 15" (M3)': ['Meia-noite', 'Estelar', 'Cinza-espacial', 'Prateado'],
  'MacBook Air 13" (M3)': ['Meia-noite', 'Estelar', 'Cinza-espacial', 'Prateado'],
  'MacBook Air 15" (M2)': ['Meia-noite', 'Estelar', 'Cinza-espacial', 'Prateado'],
  'MacBook Air 13" (M2)': ['Meia-noite', 'Estelar', 'Cinza-espacial', 'Prateado'],

  // MacBooks - Pro
  'MacBook Pro 16" (M5 Max)': ['Preto-espacial', 'Prateado'],
  'MacBook Pro 14" (M5 Pro)': ['Preto-espacial', 'Prateado'],
  'MacBook Pro 14" (M5)': ['Preto-espacial', 'Prateado'],
  'MacBook Pro 16" (M4 Max)': ['Preto-espacial', 'Prateado'],
  'MacBook Pro 14" (M4 Pro)': ['Preto-espacial', 'Prateado'],
  'MacBook Pro 16" (M3 Max)': ['Preto-espacial', 'Prateado'],
  'MacBook Pro 14" (M3)': ['Preto-espacial', 'Prateado', 'Cinza-espacial'],

   // Watch Ultra
  'Apple Watch Ultra 3': ['Titânio Preto', 'Titânio Natural'],
  'Apple Watch Ultra 2': ['Titânio Natural'],
  'Apple Watch Ultra': ['Titânio Natural'],

  // Watch Series
  'Apple Watch Series 11 (46mm)': ['Jaz Black', 'Prateado', 'Ouro Rosa', 'Cinza-espacial', 'Titânio Natural', 'Titânio Dourado', 'Titânio Ardósia'],
  'Apple Watch Series 11 (42mm)': ['Jaz Black', 'Prateado', 'Ouro Rosa', 'Cinza-espacial', 'Titânio Natural', 'Titânio Dourado', 'Titânio Ardósia'],
  'Apple Watch Series 10': ['Jaz Black', 'Ouro Rosa', 'Prateado'],
  'Apple Watch Series 9': ['Meia-noite', 'Estelar', 'Prateado', 'Rosa', 'Vermelho'],

  // Watch SE
  'Apple Watch SE (3ª Ger)': ['Estelar', 'Moonlight', 'Meia-noite'],
  'Apple Watch SE': ['Meia-noite', 'Estelar', 'Prateado'],

  // Accessories
  'AirPods Pro 3': ['Branco'],
  'AirPods Pro (2ª Ger)': ['Branco'],
  'AirPods 4': ['Branco'],
  'AirPods Max': ['Meia-noite', 'Estelar', 'Azul', 'Roxo', 'Laranja'],
  'Carregador 20W': ['Branco'],
  'Cabo USB-C': ['Branco']
};

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