import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/types';

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active?: boolean;
}

export interface MenuItemOptionChoice {
  id: string;
  option_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  sort_order: number;
}

export interface MenuItemOption {
  id: string;
  menu_item_id: string;
  name: string;
  is_required: boolean;
  max_choices: number;
  sort_order: number;
  menu_item_option_choices?: MenuItemOptionChoice[];
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  store_id?: string | null;
  menu_item_options?: MenuItemOption[];
}

type MenuResult = Tables<'menu_items'> & {
  menu_item_options?: (Tables<'menu_item_options'> & {
    menu_item_option_choices: Tables<'menu_item_option_choices'>[];
  })[];
};

function toMenuItem(row: MenuResult): MenuItem {
  return {
    ...row,
    menu_item_options: row.menu_item_options?.map(option => ({
      ...option,
      is_required: option.is_required ?? false,
      max_choices: option.max_choices ?? 1,
      sort_order: option.sort_order ?? 0,
      menu_item_option_choices: option.menu_item_option_choices.map(choice => ({
        ...choice,
        price_adjustment: choice.price_adjustment ?? 0,
        is_default: choice.is_default ?? false,
        sort_order: choice.sort_order ?? 0,
      })),
    })),
  };
}

export function useMenu(isAdmin = false, storeId?: string) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Re-fetch when storeId changes
  useEffect(() => {
    fetchMenu();
  }, [storeId]);

  const fetchMenu = async () => {
    setIsLoading(true);
    try {
      // Admins see all items, customers only see available items
      let itemsQuery = supabase.from('menu_items').select('*, menu_item_options(*, menu_item_option_choices(*))');
      if (!isAdmin) {
        itemsQuery = itemsQuery.eq('is_available', true);
      }
      if (storeId) {
        // Fetch items specifically for this store, OR universal items where store_id is null
        itemsQuery = itemsQuery.or(`store_id.eq.${storeId},store_id.is.null`);
      }

      let categoriesQuery = supabase.from('menu_categories').select('*').order('sort_order', { ascending: true });
      if (!isAdmin) {
        categoriesQuery = categoriesQuery.eq('is_active', true);
      }

      const [categoriesRes, itemsRes] = await Promise.all([
        categoriesQuery,
        itemsQuery
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setItems((itemsRes.data || []).map(toMenuItem));
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

  const addCategory = async (category: Omit<MenuCategory, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .insert(category)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setCategories(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
      }
      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding category:', error);
      return { success: false, error: error.message };
    }
  };

  const updateCategory = async (id: string, updates: Partial<MenuCategory>) => {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setCategories(prev => prev.map(cat => cat.id === id ? data : cat).sort((a, b) => a.sort_order - b.sort_order));
      }
      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating category:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      setCategories(prev => prev.filter(cat => cat.id !== id));
      // Also optimistic remove items in this category
      setItems(prev => prev.filter(item => item.category_id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting category:', error);
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
    deleteMenuItem,
    addCategory,
    updateCategory,
    deleteCategory
  };
}
