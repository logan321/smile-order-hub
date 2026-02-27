import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Order, Service, OrderItem } from '@/types';

/** Helper to get total price from an order */
export function getOrderTotal(order: Order): number {
  if (order.items && order.items.length > 0) {
    return order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }
  return 0;
}

/** Helper to get display description from an order */
export function getOrderDescription(order: Order, services: Service[]): string {
  if (order.items && order.items.length > 0) {
    const itemsDesc = order.items.map(item => {
      const svc = services.find(s => s.id === item.serviceId);
      const name = svc?.name ?? 'Serviço removido';
      return item.quantity > 1 ? `${name} (x${item.quantity})` : name;
    }).join(', ');
    return itemsDesc;
  }
  return '';
}

interface AppContextType {
  clients: Client[];
  orders: Order[];
  services: Service[];
  loading: boolean;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<void>;
  updateClient: (id: string, client: Omit<Client, 'id' | 'createdAt'>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addOrder: (order: { clientId: string; items: OrderItem[]; date: string; paid: boolean; name?: string }) => Promise<void>;
  updateOrder: (id: string, order: { clientId: string; items: OrderItem[]; date: string; paid: boolean; name?: string }) => Promise<void>;
  toggleOrderPaid: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  getClientOrders: (clientId: string) => Order[];
  getClientTotal: (clientId: string) => number;
  addService: (service: Omit<Service, 'id' | 'createdAt'>) => Promise<void>;
  updateService: (id: string, service: Omit<Service, 'id' | 'createdAt'>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) { setClients([]); setOrders([]); setServices([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [clientsRes, servicesRes, ordersRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('services').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
      ]);

      const dbClients = (clientsRes.data ?? []).map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.created_at,
      }));

      const dbServices = (servicesRes.data ?? []).map((s: any) => ({
        id: s.id, name: s.name, description: s.description, price: Number(s.price), createdAt: s.created_at,
      }));

      // Fetch order items for all orders
      const orderIds = (ordersRes.data ?? []).map((o: any) => o.id);
      let itemsMap: Record<string, OrderItem[]> = {};
      if (orderIds.length > 0) {
        const { data: allItems } = await supabase.from('order_items').select('*').in('order_id', orderIds);
        (allItems ?? []).forEach((item: any) => {
          if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
          itemsMap[item.order_id].push({
            serviceId: item.service_id,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
          });
        });
      }

      const dbOrders = (ordersRes.data ?? []).map((o: any) => ({
        id: o.id, clientId: o.client_id, trackingId: o.tracking_id,
        name: o.name ?? '',
        items: itemsMap[o.id] ?? [], date: o.date, paid: o.paid,
        status: o.status, orderType: o.order_type ?? 'designer',
        deliveryDate: o.delivery_date ?? null, createdAt: o.created_at,
      }));

      setClients(dbClients);
      setServices(dbServices);
      setOrders(dbOrders);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Clients ---
  const addClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('clients').insert({ user_id: userId!, name: data.name, phone: data.phone, email: data.email });
    if (error) throw error;
    await fetchData();
  }, [userId, fetchData]);

  const updateClient = useCallback(async (id: string, data: Omit<Client, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('clients').update({ name: data.name, phone: data.phone, email: data.email }).eq('id', id);
    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  // --- Orders ---
  const addOrder = useCallback(async (data: { clientId: string; items: OrderItem[]; date: string; paid: boolean; name?: string }) => {
    const { data: orderData, error } = await supabase.from('orders').insert({
      user_id: userId!, client_id: data.clientId, date: data.date, paid: data.paid, tracking_id: '',
      name: data.name ?? '',
    }).select('id').single();
    if (error) throw error;

    if (data.items.length > 0) {
      const { error: itemsError } = await supabase.from('order_items').insert(
        data.items.map(item => ({
          order_id: orderData.id, service_id: item.serviceId,
          quantity: item.quantity, unit_price: item.unitPrice,
        }))
      );
      if (itemsError) throw itemsError;
    }
    await fetchData();
  }, [userId, fetchData]);

  const updateOrder = useCallback(async (id: string, data: { clientId: string; items: OrderItem[]; date: string; paid: boolean; name?: string }) => {
    const { error } = await supabase.from('orders').update({
      client_id: data.clientId, date: data.date, paid: data.paid,
      name: data.name ?? '',
    }).eq('id', id);
    if (error) throw error;

    // Replace items
    await supabase.from('order_items').delete().eq('order_id', id);
    if (data.items.length > 0) {
      await supabase.from('order_items').insert(
        data.items.map(item => ({
          order_id: id, service_id: item.serviceId,
          quantity: item.quantity, unit_price: item.unitPrice,
        }))
      );
    }
    await fetchData();
  }, [fetchData]);

  const deleteOrder = useCallback(async (id: string) => {
    await supabase.from('orders').delete().eq('id', id);
    await fetchData();
  }, [fetchData]);

  const toggleOrderPaid = useCallback(async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    await supabase.from('orders').update({ paid: !order.paid }).eq('id', id);
    await fetchData();
  }, [orders, fetchData]);

  const updateOrderStatus = useCallback(async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    await fetchData();
  }, [fetchData]);

  // --- Services ---
  const addService = useCallback(async (data: Omit<Service, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('services').insert({
      user_id: userId!, name: data.name, description: data.description, price: data.price,
    });
    if (error) throw error;
    await fetchData();
  }, [userId, fetchData]);

  const updateService = useCallback(async (id: string, data: Omit<Service, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('services').update({
      name: data.name, description: data.description, price: data.price,
    }).eq('id', id);
    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  const deleteService = useCallback(async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    await fetchData();
  }, [fetchData]);

  // --- Helpers ---
  const getClientOrders = useCallback((clientId: string) => orders.filter(o => o.clientId === clientId), [orders]);
  const getClientTotal = useCallback((clientId: string) => orders.filter(o => o.clientId === clientId).reduce((sum, o) => sum + getOrderTotal(o), 0), [orders]);

  return (
    <AppContext.Provider value={{
      clients, orders, services, loading,
      addClient, updateClient, deleteClient,
      addOrder, updateOrder, deleteOrder, toggleOrderPaid, updateOrderStatus,
      getClientOrders, getClientTotal,
      addService, updateService, deleteService,
      refreshData: fetchData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
