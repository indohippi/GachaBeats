import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

// Define coin packages
interface CoinPackage {
  id: string;
  name: string;
  amount: number;
  price: number;
  isBestValue?: boolean;
  isPopular?: boolean;
}

const coinPackages: CoinPackage[] = [
  {
    id: 'small',
    name: 'Small Pack',
    amount: 100,
    price: 1.99
  },
  {
    id: 'medium',
    name: 'Medium Pack',
    amount: 500,
    price: 4.99,
    isPopular: true
  },
  {
    id: 'large',
    name: 'Large Pack',
    amount: 1000,
    price: 9.99
  },
  {
    id: 'mega',
    name: 'Mega Pack',
    amount: 3000,
    price: 24.99,
    isBestValue: true
  }
];

export default function CoinsPage() {
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [userCoins, setUserCoins] = useState(500); // This will be connected to the user's account later

  const handleSelectPackage = (pkg: CoinPackage) => {
    setSelectedPackage(pkg);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    
    setIsLoading(true);
    
    // This will be replaced with actual Stripe checkout later
    setTimeout(() => {
      // Update the user's coin balance
      setUserCoins(prev => prev + selectedPackage.amount);
      
      toast({
        title: 'Purchase Successful!',
        description: `You've added ${selectedPackage.amount} coins to your account.`,
        duration: 5000,
      });
      setIsLoading(false);
      setSelectedPackage(null);
    }, 1500);
  };

  return (
    <div className="h-full overflow-auto bg-[--gba-dark] text-white">
      <div className="container mx-auto py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Shop for Coins</h1>
            <div className="bg-[--gba-darker] p-2 rounded-lg flex items-center">
              <span className="text-xl mr-2">🪙</span>
              <span className="font-bold">{userCoins}</span>
            </div>
          </div>
          
          <p className="mb-8 text-[--gba-lightest]">
            Purchase coins to use in the gacha machine and unlock special sounds!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {coinPackages.map((pkg) => (
              <div 
                key={pkg.id} 
                className={`relative overflow-hidden transition-all bg-[--gba-darker] rounded-lg p-4 border-4 ${
                  selectedPackage?.id === pkg.id ? 'border-[--gba-primary]' : 'border-[--gba-dark]'
                } ${pkg.isPopular ? 'ring-2 ring-[--gba-primary]' : ''}`}
              >
                {(pkg.isPopular || pkg.isBestValue) && (
                  <div className={`absolute top-0 right-0 py-1 px-3 text-center text-xs font-bold ${
                    pkg.isPopular ? 'bg-[--gba-primary]' : 'bg-[#ffcc00]'
                  }`}>
                    {pkg.isPopular ? 'POPULAR' : 'BEST VALUE'}
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                    <div className="flex items-center mt-1">
                      <span className="text-lg mr-1">🪙</span>
                      <span className="text-[--gba-lightest] font-bold">{pkg.amount} Coins</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">${pkg.price.toFixed(2)}</div>
                    <div className="text-xs text-[--gba-lightest] mt-1">
                      ${(pkg.price / pkg.amount * 100).toFixed(2)}/100 coins
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button
                    className="w-full gba-pixel-border"
                    onClick={() => handleSelectPackage(pkg)}
                    variant={selectedPackage?.id === pkg.id ? "default" : "outline"}
                  >
                    {selectedPackage?.id === pkg.id ? '✓ Selected' : 'Select'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {selectedPackage && (
            <div className="flex justify-center mt-8">
              <Button 
                size="lg" 
                onClick={handlePurchase} 
                disabled={isLoading}
                className="px-8 py-6 text-lg gba-pixel-border bg-[--gba-primary] hover:bg-[--gba-primary-dark]"
              >
                {isLoading ? (
                  <>
                    <span className="mr-2">Processing</span>
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </>
                ) : (
                  <>
                    <span className="text-xl mr-2">🪙</span>
                    {`Get ${selectedPackage.amount} Coins - $${selectedPackage.price.toFixed(2)}`}
                  </>
                )}
              </Button>
            </div>
          )}
          
          <div className="mt-8 p-4 bg-[--gba-darker] rounded-lg text-sm text-center max-w-xl mx-auto text-[--gba-lightest]">
            <p>
              Purchases are processed securely. Coins are only for use within GBA Studio and have no real-world value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}