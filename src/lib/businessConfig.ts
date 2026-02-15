export interface BusinessConfig {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  document: string; // CPF/CNPJ
  paymentMethods: string;
  pixKey: string;
  bankInfo: string;
  extraNotes: string;
  whatsappNumber: string;
}

const STORAGE_KEY = 'business_config';

const defaultConfig: BusinessConfig = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  document: '',
  paymentMethods: '',
  pixKey: '',
  bankInfo: '',
  extraNotes: '',
  whatsappNumber: '',
};

export function loadBusinessConfig(): BusinessConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? { ...defaultConfig, ...JSON.parse(data) } : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export function saveBusinessConfig(config: BusinessConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
