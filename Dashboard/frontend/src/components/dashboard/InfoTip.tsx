import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTipProps {
  children: ReactNode;
  label: string;
}

export function InfoTip({ children, label }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="grid size-4 shrink-0 place-items-center rounded-full text-grey-400 transition-colors hover:text-ocean-700 focus-visible:text-ocean-700 focus-visible:outline-none"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[18rem] leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
