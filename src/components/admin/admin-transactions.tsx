import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

export const AdminTransactions = () => {
  const { transactions, fetchTransactions } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(transaction => 
    transaction.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.items.some(item => item.toLowerCase().includes(searchTerm.toLowerCase())) ||
    transaction.transaction_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'redemption':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'admin_credit':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'admin_debit':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'admin_credit':
        return 'Admin Credit';
      case 'admin_debit':
        return 'Admin Debit';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredTransactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{transaction.user_email}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {transaction.items.join(', ')}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getTransactionTypeColor(transaction.transaction_type)}>
                      {formatTransactionType(transaction.transaction_type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {transaction.points_earned > 0 && (
                    <p className="text-lg font-bold text-green-600">
                      +{transaction.points_earned} points
                    </p>
                  )}
                  {transaction.points_redeemed > 0 && (
                    <p className="text-lg font-bold text-purple-600">
                      -{transaction.points_redeemed} points
                    </p>
                  )}
                  {transaction.amount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ${transaction.amount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <p className="font-mono text-xs">{transaction.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <p className="font-mono text-xs">{transaction.user_id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No transactions found</p>
        </div>
      )}
    </div>
  );
};