import React, { useState } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { Button } from './ui/button';

interface NavigationItem {
  id: string;
  name: string;
  path: string;
  icon: React.ReactNode;
}

export default function AppNavigation() {
  const [location] = useLocation();
  
  const navigationItems: NavigationItem[] = [
    {
      id: 'daw',
      name: 'Studio',
      path: '/',
      icon: <span className="text-xl">🎛️</span>
    },
    {
      id: 'gacha',
      name: 'Gacha',
      path: '/gacha',
      icon: <span className="text-xl">🎮</span>
    },
    {
      id: 'collection',
      name: 'Sounds',
      path: '/collection',
      icon: <span className="text-xl">🎵</span>
    },
    {
      id: 'help',
      name: 'Help',
      path: '/help',
      icon: <span className="text-xl">❓</span>
    }
  ];

  const getActiveClass = (path: string) => {
    if (location === path) {
      return 'bg-[--gba-primary] text-white shadow-inner-md';
    }
    return 'bg-[--gba-dark] hover:bg-[--gba-darker] text-[--gba-lightest]';
  };

  return (
    <div className="gba-navigation w-full p-2 bg-[--gba-darker] border-b-4 border-[--gba-dark]">
      <div className="nav-container flex items-center justify-between">
        {/* App Logo and Brand */}
        <div className="brand flex items-center space-x-2">
          <span className="text-2xl font-bold tracking-tight text-[--gba-lightest]">
            GBA Studio
          </span>
        </div>
        
        {/* Navigation Tabs */}
        <div className="navigation-tabs flex space-x-1">
          {navigationItems.map((item) => (
            <Link key={item.id} href={item.path}>
              <Button
                variant="outline"
                className={`gba-pixel-border p-2 rounded flex flex-col items-center justify-center h-16 w-16 transition-colors ${getActiveClass(item.path)}`}
              >
                <div className="icon-container mb-1">
                  {item.icon}
                </div>
                <span className="text-xs">{item.name}</span>
              </Button>
            </Link>
          ))}
        </div>
        
        {/* Right side items / user info */}
        <div className="user-info">
          <Button
            size="sm"
            variant="outline"
            className="gba-pixel-border bg-[--gba-primary] text-white"
          >
            <span className="mr-1">🪙</span> 500
          </Button>
        </div>
      </div>
      
      {/* Styles moved to global CSS */}
    </div>
  );
}