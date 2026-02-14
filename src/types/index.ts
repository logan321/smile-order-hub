export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  createdAt: string;
}

export interface OrderItem {
  serviceId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  clientId: string;
  trackingId: string;
  items: OrderItem[];
  date: string;
  paid: boolean;
  status: string;
  orderType: string;
  deliveryDate: string | null;
  createdAt: string;
}

export interface OrderFile {
  id: string;
  fileName: string;
  fileUrl: string;
}

export interface OrderCustomValue {
  fieldId: string;
  fieldName: string;
  value: string;
}

export interface ClientReport {
  client: Client;
  orders: Order[];
  total: number;
}
