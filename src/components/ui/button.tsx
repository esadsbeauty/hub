import * as React from 'react';
import {cva,type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';
const variants=cva('inline-flex items-center justify-center gap-2 rounded-xl text-[17px] font-semibold smooth premium-focus disabled:pointer-events-none disabled:opacity-45 md:text-sm',{variants:{variant:{default:'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,.12)] hover:bg-primary/88',outline:'border border-border/80 bg-card hover:bg-muted/70',ghost:'text-muted-foreground hover:bg-muted hover:text-foreground',champagne:'bg-champagne-soft text-foreground hover:bg-champagne/30'},size:{sm:'h-12 min-w-12 px-4 text-base md:h-9 md:min-w-9 md:px-3 md:text-xs',default:'h-[var(--mobile-button-height)] px-5 md:h-11 md:px-4',lg:'h-[3.75rem] px-6 md:h-12 md:px-5'}},defaultVariants:{variant:'default',size:'default'}});
export type ButtonProps=React.ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>;
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,...props},ref)=><button ref={ref} className={cn(variants({variant,size,className}))}{...props}/>);Button.displayName='Button';
