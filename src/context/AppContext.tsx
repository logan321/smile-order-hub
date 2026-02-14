import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Client, Order, Service, OrderItem } from '@/types';

/** Helper to get total price from an order (supports legacy single-service orders) */
export function getOrderTotal(order: Order): number {
  if (order.items && order.items.length > 0) {
    return order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }
  // legacy fallback
  return (order as any).price ?? 0;
}

/** Helper to get display description from an order */
export function getOrderDescription(order: Order, services: Service[]): string {
  if (order.items && order.items.length > 0) {
    return order.items.map(item => {
      const svc = services.find(s => s.id === item.serviceId);
      const name = svc?.name ?? 'Serviço removido';
      return item.quantity > 1 ? `${name} (x${item.quantity})` : name;
    }).join(', ');
  }
  return (order as any).service ?? '';
}

interface AppContextType {
  clients: Client[];
  orders: Order[];
  services: Service[];
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, client: Omit<Client, 'id' | 'createdAt'>) => void;
  deleteClient: (id: string) => void;
  addOrder: (order: { clientId: string; items: OrderItem[]; date: string; paid: boolean }) => void;
  updateOrder: (id: string, order: { clientId: string; items: OrderItem[]; date: string; paid: boolean }) => void;
  toggleOrderPaid: (id: string) => void;
  deleteOrder: (id: string) => void;
  getClientOrders: (clientId: string) => Order[];
  getClientTotal: (clientId: string) => number;
  addService: (service: Omit<Service, 'id' | 'createdAt'>) => void;
  updateService: (id: string, service: Omit<Service, 'id' | 'createdAt'>) => void;
  deleteService: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>(() => loadFromStorage('clients', []));
  const [orders, setOrders] = useState<Order[]>(() => loadFromStorage('orders', []));
  const [services, setServices] = useState<Service[]>(() => loadFromStorage('services', []));

  useEffect(() => { localStorage.setItem('clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('services', JSON.stringify(services)); }, [services]);

  const addClient = useCallback((data: Omit<Client, 'id' | 'createdAt'>) => {
    setClients(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateClient = useCallback((id: string, data: Omit<Client, 'id' | 'createdAt'>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    setOrders(prev => prev.filter(o => o.clientId !== id));
  }, []);

  const addOrder = useCallback((data: { clientId: string; items: OrderItem[]; date: string; paid: boolean }) => {
    setOrders(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateOrder = useCallback((id: string, data: { clientId: string; items: OrderItem[]; date: string; paid: boolean }) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  const toggleOrderPaid = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, paid: !o.paid } : o));
  }, []);

  const getClientOrders = useCallback((clientId: string) => {
    return orders.filter(o => o.clientId === clientId);
  }, [orders]);

  const getClientTotal = useCallback((clientId: string) => {
    return orders.filter(o => o.clientId === clientId).reduce((sum, o) => sum + getOrderTotal(o), 0);
  }, [orders]);

  // Services
  const addService = useCallback((data: Omit<Service, 'id' | 'createdAt'>) => {
    setServices(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateService = useCallback((id: string, data: Omit<Service, 'id' | 'createdAt'>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{ clients, orders, services, addClient, updateClient, deleteClient, addOrder, updateOrder, deleteOrder, toggleOrderPaid, getClientOrders, getClientTotal, addService, updateService, deleteService }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
