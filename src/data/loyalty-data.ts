export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  imageUrl?: string;
  category: 'food' | 'drink' | 'special';
  available: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  pointsEarned: number;
  pointsRedeemed?: number;
  items: string[];
  type: 'purchase' | 'redemption';
}

export const sampleRewards: Reward[] = [
  {
    id: '1',
    name: 'Free Small Fries',
    description: 'Crispy golden fries, freshly made',
    pointsCost: 100,
    category: 'food',
    available: true,
  },
  {
    id: '2',
    name: 'Free Soft Drink',
    description: 'Any regular size soft drink',
    pointsCost: 150,
    category: 'drink',
    available: true,
  },
  {
    id: '3',
    name: 'Free Burger',
    description: 'Classic beef burger with all the fixings',
    pointsCost: 300,
    category: 'food',
    available: true,
  },
  {
    id: '4',
    name: '20% Off Next Order',
    description: 'Discount applies to your entire order',
    pointsCost: 200,
    category: 'special',
    available: true,
  },
  {
    id: '5',
    name: 'Birthday Special',
    description: 'Free meal on your birthday month',
    pointsCost: 500,
    category: 'special',
    available: false,
  },
];

export const sampleTransactions: Transaction[] = [
  {
    id: '1',
    date: '2024-01-15',
    amount: 12.99,
    pointsEarned: 13,
    items: ['Classic Burger', 'Medium Fries'],
    type: 'purchase',
  },
  {
    id: '2',
    date: '2024-01-12',
    amount: 0,
    pointsEarned: 0,
    pointsRedeemed: 150,
    items: ['Free Soft Drink'],
    type: 'redemption',
  },
  {
    id: '3',
    date: '2024-01-10',
    amount: 8.50,
    pointsEarned: 9,
    items: ['Chicken Wrap', 'Small Drink'],
    type: 'purchase',
  },
  {
    id: '4',
    date: '2024-01-08',
    amount: 15.75,
    pointsEarned: 16,
    items: ['Double Cheeseburger', 'Large Fries', 'Milkshake'],
    type: 'purchase',
  },
];

export const currentUserPoints = 287;
export const nextReward = sampleRewards[2]; // Free Burger at 300 points