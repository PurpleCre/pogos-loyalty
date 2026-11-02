import { logPrivateError } from '@/lib/privacy-logging';
import { useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useReadResource } from './useReadResource';
import { createBrowsingCache, menuBrowseSchema } from '@/lib/browsing-cache';
import { runtimeEnvironment } from '@/lib/environment';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/types';
import { useAuth } from './useAuth';
import { accessTokenFor } from '@/lib/cash-orders';

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
  const { user } = useAuth();
  const owner = user?.id;
  const scope = `${owner ?? 'guest'}:${isAdmin}:${storeId ?? 'all'}`;
  const cache = useMemo(() => isAdmin ? undefined : createBrowsingCache(AsyncStorage, runtimeEnvironment.name, `menu:${storeId ?? 'all'}`, menuBrowseSchema), [isAdmin, storeId]);
  const load = useCallback(async (signal: AbortSignal): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> => {
    let itemsQuery = supabase.from('menu_items').select('*, menu_item_options(*, menu_item_option_choices(*))').abortSignal(signal);
    if (!isAdmin) itemsQuery = itemsQuery.eq('is_available', true);
    if (storeId) itemsQuery = itemsQuery.or(`store_id.eq.${storeId},store_id.is.null`);
    let categoriesQuery = supabase.from('menu_categories').select('*').order('sort_order').abortSignal(signal);
    if (!isAdmin) categoriesQuery = categoriesQuery.eq('is_active', true);
    const token = owner ? await accessTokenFor(owner) : null;
    if (token) { itemsQuery = itemsQuery.setHeader('Authorization', `Bearer ${token}`); categoriesQuery = categoriesQuery.setHeader('Authorization', `Bearer ${token}`); }
    const [categories, items, availability] = await Promise.all([
      categoriesQuery, itemsQuery,
      storeId && !isAdmin ? supabase.from('branch_menu_availability').select('menu_item_id,available').eq('store_id', storeId).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [categories, items, availability]) if (result.error) throw result.error;
    const unavailable = new Set(availability.data?.filter(row => !row.available).map(row => row.menu_item_id));
    const visibleCategories = categories.data ?? [];
    const categoryIds = new Set(visibleCategories.map(row => row.id));
    return { categories: visibleCategories, items: (items.data ?? []).filter(row => !unavailable.has(row.id) && (isAdmin || categoryIds.has(row.category_id))).map(toMenuItem) };
  }, [isAdmin, storeId, owner]);
  const resource = useReadResource(scope, load, { cache });
  const fetchMenu = resource.refetch;
  // Mutations refresh current server data; no optimistic array can be mistaken
  // for an authoritative response or saved into the public browsing cache.
  const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ category_id: item.category_id, name: item.name, description: item.description, price: item.price, image_url: item.image_url, is_available: item.is_available, store_id: item.store_id })
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        void fetchMenu();
      }
      return { success: true, data };
    } catch (error: any) {
      logPrivateError('Error adding menu item:', error);
      return { success: false, error: error.message };
    }
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .update({ category_id: updates.category_id, name: updates.name, description: updates.description, price: updates.price, image_url: updates.image_url, is_available: updates.is_available, store_id: updates.store_id })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        void fetchMenu();
      }
      return { success: true, data };
    } catch (error: any) {
      logPrivateError('Error updating menu item:', error);
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
      void fetchMenu();
      return { success: true };
    } catch (error: any) {
      logPrivateError('Error deleting menu item:', error);
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
        void fetchMenu();
      }
      return { success: true, data };
    } catch (error: any) {
      logPrivateError('Error adding category:', error);
      return { success: false, error: error.message };
    }
  };

  const updateCategory = async (id: string, updates: Partial<MenuCategory>) => {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .update({ name: updates.name, sort_order: updates.sort_order, is_active: updates.is_active })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        void fetchMenu();
      }
      return { success: true, data };
    } catch (error: any) {
      logPrivateError('Error updating category:', error);
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
      void fetchMenu();
      // Also optimistic remove items in this category
      void fetchMenu();
      return { success: true };
    } catch (error: any) {
      logPrivateError('Error deleting category:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    categories: resource.data?.categories ?? [],
    items: resource.data?.items ?? [],
    isLoading: resource.loading,
    fresh: resource.fresh, refreshedAt: resource.refreshedAt,
    error: resource.error ? 'Menu availability could not be confirmed. Saved selections need a fresh online total.' : '',
    refetch: fetchMenu,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addCategory,
    updateCategory,
    deleteCategory
  };
}
