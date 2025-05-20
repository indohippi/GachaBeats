import React from 'react';
import GachaCapture from '../components/gacha/GachaCapture';
import { Toaster } from '../components/ui/toaster';

export default function GachaApp() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 w-full h-full overflow-hidden">
        <GachaCapture />
      </div>
      <Toaster />
    </div>
  );
}