export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Order {
  id: string;
  clientId: string;
  service: string;
  price: number;
  date: string;
  createdAt: string;
}

export interface ClientReport {
  client: Client;
  orders: Order[];
  total: number;
}
