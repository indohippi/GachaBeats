import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface Sound {
  id: number;
  name: string;
  rarity: string;
  url: string;
}

export default function GachaSystem() {
  const [pulling, setPulling] = useState(false);
  const { toast } = useToast();

  const { data: collection = [] } = useQuery<Sound[]>({
    queryKey: ['sounds'],
    queryFn: async () => {
      const response = await fetch('/api/sounds');
      if (!response.ok) {
        throw new Error('Failed to fetch sounds');
      }
      const data = await response.json();
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    },
  });

  const pullMutation = useMutation({
    mutationFn: () => 
      fetch('/api/gacha/pull', { method: 'POST' }).then(res => res.json()),
    onSuccess: (sound: Sound) => {
      toast({
        title: "New Sound Unlocked!",
        description: `You got: ${sound.name} (${sound.rarity})`,
      });
    },
  });

  const handlePull = async () => {
    setPulling(true);
    try {
      await pullMutation.mutateAsync();
    } finally {
      setPulling(false);
    }
  };

  return (
    <Card className="gba-pixel-border p-4">
      <h2 className="text-lg font-bold mb-4">Sound Gacha</h2>
      
      <div className="space-y-4">
        <Button 
          className="gba-button w-full"
          disabled={pulling}
          onClick={handlePull}
        >
          {pulling ? 'Pulling...' : 'Pull Once (Daily Free)'}
        </Button>

        <div className="space-y-2">
          <h3 className="text-sm font-bold">Collection</h3>
          <Progress 
            value={collection?.length ?? 0} 
            max={100}
            className="h-2"
          />
          <p className="text-xs text-[--gba-light]">
            {collection?.length ?? 0}/100 Sounds
          </p>
        </div>

        <div className="h-48 overflow-y-auto">
          {collection?.map(sound => (
            <div 
              key={sound.id}
              className="flex items-center justify-between p-2 hover:bg-[--gba-dark]"
            >
              <span>{sound.name}</span>
              <span className={`text-xs ${
                sound.rarity === 'legendary' ? 'text-yellow-400' :
                sound.rarity === 'rare' ? 'text-blue-400' :
                'text-gray-400'
              }`}>
                {sound.rarity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
