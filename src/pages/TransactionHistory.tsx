import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { History, Star, ShoppingBag, Gift } from 'lucide-react';

export default function TransactionHistory() {
  const { user } = useAuth();
  const { transactions, userPoints, loading: rewardsLoading } = useRewards();
  const [filter, setFilter] = useState<'all' | 'purchase' | 'redemption'>('all');

  if (rewardsLoading) {
    return null; // Layout handles loading
  }

  if (!user) {
    return null;
  }

  const filteredTransactions = transactions.filter(transaction => 
    filter === 'all' || transaction.transaction_type === filter
  );

  const getTransactionIcon = (type: string) => {
    return type === 'purchase' ? <ShoppingBag className="h-4 w-4" /> : <Gift className="h-4 w-4" />;
  };

  const getTransactionColor = (type: string) => {
    return type === 'purchase' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800';
  };

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-6 px-4 max-w-7xl mx-auto">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6 animate-in fade-in slide-in-from-top duration-500">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold">{userPoints?.current_points || 0}</p>
                <p className="text-xs text-muted-foreground">Current Points</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <ShoppingBag className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{userPoints?.total_earned || 0}</p>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Gift className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">{userPoints?.total_redeemed || 0}</p>
                <p className="text-xs text-muted-foreground">Total Redeemed</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-2 bg-card p-1 rounded-lg mb-6 animate-in fade-in slide-in-from-top duration-700">
            {[
              { key: 'all', label: 'All' },
              { key: 'purchase', label: 'Purchases' },
              { key: 'redemption', label: 'Redemptions' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all duration-200 ${
                  filter === tab.key
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-700">
            <h2 className="text-2xl font-bold">Transaction History</h2>
            {filteredTransactions.length > 0 ? (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => (
                  <Card key={transaction.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${getTransactionColor(transaction.transaction_type)}`}>
                            {getTransactionIcon(transaction.transaction_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{transaction.items.join(', ')}</h3>
                              <Badge className={getTransactionColor(transaction.transaction_type)}>
                                {transaction.transaction_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {transaction.transaction_type === 'purchase' ? (
                            <>
                              <p className="text-lg font-bold text-green-600">
                                +{transaction.points_earned} points
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ${transaction.amount?.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-bold text-purple-600">
                                -{transaction.points_redeemed} points
                              </p>
                              <p className="text-sm text-muted-foreground">Redeemed</p>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {filter === 'all' 
                        ? 'No transactions yet. Start earning points by making purchases!'
                        : `No ${filter} transactions found.`
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}