import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  extra?: ReactNode;
}

export default function Card({
  children,
  className = '',
  onClick,
  title,
  extra,
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${
        onClick
          ? 'w-full text-left cursor-pointer hover:shadow-md active:scale-[0.99] transition-all'
          : ''
      } ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {extra && <div className="shrink-0 ml-3">{extra}</div>}
        </div>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}
