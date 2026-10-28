import Link from "next/link";

export function NavItem({
  href,
  icon,
  label,
  active,
  collapsed = false,
  onClick,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  /** Something waiting on this page; nothing shows at 0. */
  badge?: number;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        collapsed ? 'md:justify-center md:px-0' : ''
      } ${
        active
          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      <span className={`relative shrink-0 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {icon}
        {/* On the icon's corner, so it costs the label no width and survives the rail. */}
        {!!badge && (
          <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold leading-none inline-flex items-center justify-center">
            {badge}
          </span>
        )}
      </span>
      {/* Rail mode is desktop-only; the mobile drawer always shows labels. */}
      <span className={collapsed ? 'md:sr-only' : 'whitespace-nowrap'}>{label}</span>
    </Link>
  );
}
