import { useState, useCallback } from 'react';
import { MOCK_CLIENTS } from '../mockData';
import type { Client } from '../types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);

  const getById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const addClient = useCallback((client: Omit<Client, 'id'>) => {
    const newClient: Client = { ...client, id: `c-${Date.now()}` };
    setClients(prev => [...prev, newClient]);
    return newClient;
  }, []);

  return { clients, getById, updateClient, addClient };
}
