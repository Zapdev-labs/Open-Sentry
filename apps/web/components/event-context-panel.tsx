interface EventContextPanelProps {
  tags: Record<string, string>;
  user?: Record<string, string> | null;
  environment?: string | null;
  release?: string | null;
  timestamp: Date;
}

export function EventContextPanel({
  tags,
  user,
  environment,
  release,
  timestamp,
}: EventContextPanelProps) {
  const tagEntries = Object.entries(tags);
  const userEntries = user ? Object.entries(user) : [];
  const hasContent =
    tagEntries.length > 0 ||
    userEntries.length > 0 ||
    environment ||
    release;

  if (!hasContent) {
    return (
      <div className="card context-panel">
        <p className="meta">No context metadata for this event.</p>
        <p className="meta" style={{ marginTop: 8 }}>
          Captured {timestamp.toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="context-grid">
      <div className="card context-panel">
        <h4 className="context-heading">Event</h4>
        <dl className="context-list">
          <div className="context-row">
            <dt>Timestamp</dt>
            <dd>{timestamp.toLocaleString()}</dd>
          </div>
          {environment && (
            <div className="context-row">
              <dt>Environment</dt>
              <dd>{environment}</dd>
            </div>
          )}
          {release && (
            <div className="context-row">
              <dt>Release</dt>
              <dd className="code-block">{release}</dd>
            </div>
          )}
        </dl>
      </div>

      {userEntries.length > 0 && (
        <div className="card context-panel">
          <h4 className="context-heading">User</h4>
          <dl className="context-list">
            {userEntries.map(([key, value]) => (
              <div key={key} className="context-row">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tagEntries.length > 0 && (
        <div className="card context-panel">
          <h4 className="context-heading">Tags</h4>
          <div className="tag-list">
            {tagEntries.map(([key, value]) => (
              <span key={key} className="tag-chip">
                <span className="tag-key">{key}</span>
                <span className="tag-value">{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
