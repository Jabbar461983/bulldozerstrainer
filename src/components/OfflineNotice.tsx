interface OfflineNoticeProps {
  cachedAt: number;
}

export function OfflineNotice({ cachedAt }: OfflineNoticeProps) {
  return (
    <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning">
      Offline – Stand vom {new Date(cachedAt).toLocaleString('de-CH')}
    </p>
  );
}
