import * as React from 'react';
import { cn } from '@/lib/utils';
export const Radio = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} type="radio" className={cn('h-4 w-4 border accent-champagne-dark premium-focus', className)} {...props} />);Radio.displayName = 'Radio';
