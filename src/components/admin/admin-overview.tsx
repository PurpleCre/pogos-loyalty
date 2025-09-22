import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Gift, CreditCard, TrendingUp } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

export const AdminOverview = () => {
  const { users, rewards, transactions, fetchUsers, fetchRewards, fetchTransactions } = useAdmin();

  useEffect(() => {
    fetchUsers();
    fetchRewards();
    fetchTransactions();
  }, []);

  const totalUsers = users.length;
  const totalRewards = rewards.length;
  const totalTransactions = transactions.length;
  const totalPointsEarned = users.reduce((sum, user) => sum + user.total_earned, 0);
  const totalPointsRedeemed = users.reduce((sum, user) => sum + user.total_redeemed, 0);
  const activeRewards = rewards.filter(reward => reward.available).length;

  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Active Rewards",
      value: `${activeRewards}/${totalRewards}`,
      icon: Gift,
      color: "text-green-600"
    },
    {
      title: "Total Transactions",
      value: totalTransactions,
      icon: CreditCard,
      color: "text-purple-600"
    },
    {
      title: "Points Earned",
      value: totalPointsEarned.toLocaleString(),
      icon: TrendingUp,
      color: "text-orange-600"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{transaction.user_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.transaction_type} - {transaction.items.join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    {transaction.transaction_type === 'purchase' ? (
                      <p className="text-sm font-medium text-green-600">+{transaction.points_earned}</p>
                    ) : (
                      <p className="text-sm font-medium text-purple-600">-{transaction.points_redeemed}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Users by Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users
                .sort((a, b) => b.current_points - a.current_points)
                .slice(0, 5)
                .map((user) => (
                  <div key={user.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{user.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{user.current_points} pts</p>
                      <p className="text-xs text-muted-foreground">
                        {user.role === 'admin' && <span className="text-orange-500">Admin</span>}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};