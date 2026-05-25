'use client';

import Link from 'next/link';
import { ChevronFirst } from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { Button } from '@/components/ui/button';

export function SidebarHeader() {
  const { settings, storeOption } = useSettings();

  const handleToggleClick = () => {
    storeOption(
      'layouts.demo1.sidebarCollapse',
      !settings.layouts.demo1.sidebarCollapse,
    );
  };

  return (
    <div className="sidebar-header hidden lg:flex items-center relative justify-center px-3 lg:px-6 pt-8 shrink-0">
      <Link href="/" className="flex w-full justify-center">
        <div className="dark:hidden flex justify-center">
          <img
            src={toAbsoluteUrl('/media/app/kglogo.png')}
            className="default-logo h-[64px] max-w-none object-contain"
            alt="Default Logo"
          />

          <img
            src={toAbsoluteUrl('/media/app/mini-logo.svg')}
            className="small-logo h-[48px] max-w-none object-contain"
            alt="Mini Logo"
          />
        </div>
        <div className="hidden dark:block">
          <img
            src={toAbsoluteUrl('/media/app/default-logo-dark.svg')}
            className="default-logo h-[64px] max-w-none object-contain"
            alt="Default Dark Logo"
          />

          <img
            src={toAbsoluteUrl('/media/app/mini-logo.svg')}
            className="small-logo h-[48px] max-w-none object-contain"
            alt="Mini Logo"
          />
        </div>
      </Link>
      <Button
        onClick={handleToggleClick}
        size="sm"
        mode="icon"
        variant="outline"
        className={cn(
          'size-7 absolute start-full top-2/4 rtl:translate-x-2/4 -translate-x-2/4 -translate-y-2/4',
          settings.layouts.demo1.sidebarCollapse
            ? 'ltr:rotate-180'
            : 'rtl:rotate-180',
        )}
      >
        <ChevronFirst className="size-4!" />
      </Button>
    </div>
  );
}
