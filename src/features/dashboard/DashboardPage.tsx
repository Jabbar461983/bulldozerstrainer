import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/Card';
import { NAV_ITEMS } from '../../layout/navItems';

export function DashboardPage() {
  const { profile, isAdmin, canAccess, memberships } = useAuth();

  const quickLinks = NAV_ITEMS.filter((item) => {
    if (item.to === '/') return false;
    if (item.adminOnly) return isAdmin;
    if (item.module) return canAccess(item.module);
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text">
          Willkommen{profile ? `, ${profile.first_name}` : ''}
        </h1>
        <p className="text-sm text-text-muted">
          {isAdmin
            ? 'Du bist als Admin angemeldet und hast Zugriff auf alle Teams und Module.'
            : `Du bist Coach in ${memberships.length} Team(s).`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quickLinks.map((item) => (
          <NavLink key={item.to} to={item.to}>
            <Card className="flex flex-col items-center gap-2 py-6 text-center transition hover:border-accent hover:bg-accent/5">
              <span className="text-accent">{item.icon}</span>
              <span className="text-sm font-medium text-text">{item.label}</span>
            </Card>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
