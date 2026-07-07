import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

export function useMenu(isAdmin = false) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMenu = async () => {
    setIsLoading(true);
    try {
      // Admins see all items, customers only see available items
      let itemsQuery = supabase.from('menu_items').select('*');
      if (!isAdmin) {
        itemsQuery = itemsQuery.eq('is_available', true);
      }

      const [categoriesRes, itemsRes] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        itemsQuery
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setItems(itemsRes.data || []);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert(item)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setItems(prev => [...prev, data]);
      }
      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding menu item:', error);
      return { success: false, error: error.message };
    }
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setItems(prev => prev.map(item => item.id === id ? data : item));
      }
      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating menu item:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteMenuItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting menu item:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [isAdmin]);

  return {
    categories,
    items,
    isLoading,
    refetch: fetchMenu,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem
  };
}
