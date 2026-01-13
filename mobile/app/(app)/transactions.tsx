import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useRewards } from '@/hooks/useRewards';
import { format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';

export default function Transactions() {
  const { transactions, loading } = useRewards();

  if (loading && transactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-slate-400">No transactions yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center py-4 border-b border-slate-100">
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${item.transaction_type === 'purchase' ? 'bg-green-100' : 'bg-orange-100'}`}>
              {item.transaction_type === 'purchase' ? (
                <ArrowDownLeft size={20} color="#16a34a" />
              ) : (
                <ArrowUpRight size={20} color="#ea580c" />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-medium text-slate-900 capitalize">
                {item.transaction_type}
              </Text>
              <Text className="text-xs text-slate-500">
                {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
              </Text>
              {item.items && item.items.length > 0 && (
                <Text className="text-xs text-slate-400 mt-1" numberOfLines={1}>
                  {item.items.join(', ')}
                </Text>
              )}
            </View>
            <View className="items-end">
              <Text className={`font-bold ${item.transaction_type === 'purchase' ? 'text-green-600' : 'text-slate-900'}`}>
                {item.transaction_type === 'purchase' ? '+' : '-'}{item.transaction_type === 'purchase' ? item.points_earned : item.points_redeemed} pts
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
