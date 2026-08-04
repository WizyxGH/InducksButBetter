import React from 'react';
import { navigate, getBasePath, isModifiedClick } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, className, children, onClick, ...props }, ref) => {
    
    // Resolve full path for the href attribute so native browser features (right click -> open in new tab) work correctly
    const normalizedTo = to.startsWith('/') ? to : `/${to}`;
    const href = `${getBasePath()}${normalizedTo}`;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(e);
      }

      // Let the browser do its thing on ctrl/cmd/shift/alt or middle click,
      // when the handler above already took over, or on an explicit new tab.
      if (isModifiedClick(e) || props.target === '_blank') {
        return;
      }

      e.preventDefault();
      navigate(normalizedTo, replace);
    };

    return (
      <a
        ref={ref}
        href={href}
        onClick={handleClick}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </a>
    );
  }
);
Link.displayName = 'Link';
