import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomField {
  id: string;
  name: string;
  fieldType: string; // text, number, date, select
  options: string[];
  position: number;
}

export function useCustomFields() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    const { data } = await supabase
      .from('custom_fields')
      .select('*')
      .order('position', { ascending: true });
    setFields((data as any[])?.map(f => ({
      id: f.id, name: f.name, fieldType: f.field_type,
      options: f.options ?? [], position: f.position,
    })) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const addField = useCallback(async (name: string, fieldType: string, options: string[] = []) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const position = fields.length;
    await supabase.from('custom_fields').insert({
      user_id: session.user.id, name, field_type: fieldType, options, position,
    });
    await fetchFields();
  }, [fields, fetchFields]);

  const updateField = useCallback(async (id: string, name: string, fieldType: string, options: string[] = []) => {
    await supabase.from('custom_fields').update({ name, field_type: fieldType, options }).eq('id', id);
    await fetchFields();
  }, [fetchFields]);

  const deleteField = useCallback(async (id: string) => {
    await supabase.from('custom_fields').delete().eq('id', id);
    await fetchFields();
  }, [fetchFields]);

  return { fields, loading, addField, updateField, deleteField };
}
