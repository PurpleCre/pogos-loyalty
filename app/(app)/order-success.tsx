import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/types';
import { formatMoney } from '@/lib/cash-orders';

function textField(value: unknown, field: string): string {
  if (typeof value !== 'object' || value === null || !(field in value)) return '';
  const result = (value as Record<string, unknown>)[field];
  return typeof result === 'string' ? result : '';
}

export default function OrderSuccessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const [record, setRecord] = useState<{ owner: string; order: Tables<'orders'>; items: Tables<'order_items'>[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const order = record && record.owner === user?.id ? record.order : null;
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    if (!user || !orderId) { setLoading(false); setError('Sign in to view your order.'); return; }
    void (async () => {
      const [orderResult, itemsResult] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).eq('user_id', user.id).single(),
        supabase.from('order_items').select('*').eq('order_id', orderId),
      ]);
      if (cancelled) return;
      if (orderResult.error || itemsResult.error) { setError('Unable to load this order. Check your order history or contact your branch.'); return; }
      setRecord({ owner: user.id, order: orderResult.data, items: itemsResult.data });
    })().catch(() => { if (!cancelled) setError('Unable to load your order. Please check your order history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, user?.id]);

  return <View className="flex-1 bg-slate-50">
    <View className="bg-red-600 pt-14 pb-5 px-5"><Text className="text-white text-xl font-bold">Pogo’s</Text></View>
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      {loading ? <ActivityIndicator color="#dc2626" /> : error ? <Text className="text-red-700">{error}</Text> : order ? <>
        <Text className="text-2xl font-bold text-slate-900">Order received</Text>
        <Text className="mt-3 text-slate-600">Order #{order.id.slice(0, 8).toUpperCase()}</Text>
        <Text className="mt-2 text-slate-600">{order.status === 'pending' ? 'Awaiting confirmation from your branch.' : `Status: ${order.status}`}</Text>
        <View className="p-5 bg-white rounded-xl border border-slate-200 my-5">
          <Text className="font-bold text-lg">{textField(order.branch_snapshot, 'name') || 'Your selected branch'}</Text>
          <Text className="mt-2">{order.fulfilment_mode === 'delivery' ? 'Cash on delivery' : 'Cash on collection'}</Text>
          {order.fulfilment_mode === 'delivery' ? <Text className="mt-2">{textField(order.delivery_snapshot, 'address')}</Text> : null}
          <Text className="mt-2">{textField(order.contact_snapshot, 'name')} · {textField(order.contact_snapshot, 'phone')}</Text>
          {record?.items.map(item => <View key={item.id} className="mt-4"><Text>{item.quantity} × {item.item_name ?? 'Meal'}</Text><Text className="text-slate-500 text-sm">{Array.isArray(item.modifiers_snapshot) ? item.modifiers_snapshot.map(choice => textField(choice, 'name')).join(', ') : ''}</Text></View>)}
          {order.total_minor !== null && order.currency ? <Text className="font-bold text-xl mt-5">Cash due: {formatMoney(order.total_minor, order.currency)}</Text> : null}
          <Text className="mt-2 text-slate-500">Payment status: {order.payment_status ?? 'Check with branch'}</Text>
        </View>
        <Text className="text-slate-600">Your branch will confirm preparation and handover. Points are not awarded for placing an unpaid order.</Text>
      </> : null}
      <TouchableOpacity onPress={() => router.push('/(app)/order-tracking')} className="bg-red-600 p-4 rounded-xl items-center mt-6"><Text className="text-white font-bold">View orders</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/store-picker')} className="p-4 items-center mt-3"><Text className="text-red-600 font-bold">Back to branches</Text></TouchableOpacity>
    </ScrollView>
  </View>;
}
