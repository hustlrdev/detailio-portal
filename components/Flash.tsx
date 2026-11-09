export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <p className="flash flash-err" role="alert">{error}</p>;
  if (saved) return <p className="flash flash-ok" role="status">Saved.</p>;
  return null;
}
