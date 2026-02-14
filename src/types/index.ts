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
  items: OrderItem[];
  date: string;
  paid: boolean;
  createdAt: string;
  /** @deprecated kept for backward compat with old localStorage data */
  service?: string;
  /** @deprecated kept for backward compat with old localStorage data */
  price?: number;
}

export interface ClientReport {
  client: Client;
  orders: Order[];
  total: number;
}
