import { Card } from './Card';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text">{title}</h1>
      <Card>
        <p className="text-sm text-text-muted">{description}</p>
      </Card>
    </div>
  );
}
