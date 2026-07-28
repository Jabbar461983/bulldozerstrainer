import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/Card';

export function DashboardPage() {
  const { profile, isAdmin, memberships } = useAuth();

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

      <Card>
        <p className="text-sm text-text-muted">
          Dieses Dashboard wird in den nächsten Ausbauschritten mit Kennzahlen zu Training,
          Spielen und Finanzen befüllt (nächster Ausbau: Rollen- &amp; Userverwaltung).
        </p>
      </Card>
    </div>
  );
}
