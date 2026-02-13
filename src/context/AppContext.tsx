import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Client, Order } from '@/types';

interface AppContextType {
  clients: Client[];
  orders: Order[];
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, client: Omit<Client, 'id' | 'createdAt'>) => void;
  deleteClient: (id: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => void;
  updateOrder: (id: string, order: Omit<Order, 'id' | 'createdAt'>) => void;
  deleteOrder: (id: string) => void;
  getClientOrders: (clientId: string) => Order[];
  getClientTotal: (clientId: string) => number;
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

  useEffect(() => { localStorage.setItem('clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);

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

  const addOrder = useCallback((data: Omit<Order, 'id' | 'createdAt'>) => {
    setOrders(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateOrder = useCallback((id: string, data: Omit<Order, 'id' | 'createdAt'>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  const getClientOrders = useCallback((clientId: string) => {
    return orders.filter(o => o.clientId === clientId);
  }, [orders]);

  const getClientTotal = useCallback((clientId: string) => {
    return orders.filter(o => o.clientId === clientId).reduce((sum, o) => sum + o.price, 0);
  }, [orders]);

  return (
    <AppContext.Provider value={{ clients, orders, addClient, updateClient, deleteClient, addOrder, updateOrder, deleteOrder, getClientOrders, getClientTotal }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
