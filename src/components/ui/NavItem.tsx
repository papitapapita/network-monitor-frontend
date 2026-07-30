import Link from "next/link";

export function NavItem({
  href,
  icon,
  label,
  active,
  collapsed = false,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
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
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {icon}
      </span>
      {/* Rail mode is desktop-only; the mobile drawer always shows labels. */}
      <span className={collapsed ? 'md:sr-only' : 'whitespace-nowrap'}>{label}</span>
    </Link>
  );
}
