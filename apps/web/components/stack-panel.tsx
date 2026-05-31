import type { StackFrame } from "@sentry-clone/db";

interface StackPanelProps {
  frames: StackFrame[];
}

export function StackPanel({ frames }: StackPanelProps) {
  if (frames.length === 0) {
    return <p className="meta">No stack trace available.</p>;
  }

  const inAppCount = frames.filter((f) => f.inApp !== false).length;
  const systemCount = frames.length - inAppCount;

  return (
    <div>
      <div className="stack-meta">
        <span>{frames.length} frames</span>
        {inAppCount > 0 && <span className="stack-meta-tag stack-meta-inapp">{inAppCount} in-app</span>}
        {systemCount > 0 && <span className="stack-meta-tag stack-meta-system">{systemCount} system</span>}
      </div>
      <div className="stack-trace">
        {frames.map((frame, i) => {
          const isInApp = frame.inApp !== false;
          return (
            <div
              key={`${frame.filename}-${frame.lineno}-${i}`}
              className={`stack-frame ${isInApp ? "stack-frame-inapp" : "stack-frame-system"}`}
            >
              <div className="stack-frame-header">
                <span className="stack-frame-index">{i + 1}</span>
                <span className="code-block">{frame.function ?? "anonymous"}</span>
                {!isInApp && <span className="badge badge-system">system</span>}
                {frame.module && isInApp && (
                  <span className="stack-module">{frame.module}</span>
                )}
              </div>
              <div className="stack-frame-location">
                {frame.filename ?? "unknown"}
                {frame.lineno != null && `:${frame.lineno}`}
                {frame.colno != null && `:${frame.colno}`}
              </div>
              {frame.contextLine && (
                <div className="stack-context">
                  {frame.preContext?.map((line, j) => (
                    <div key={`pre-${j}`} className="stack-context-line">
                      {line}
                    </div>
                  ))}
                  <div className="stack-context-line stack-context-highlight">
                    {frame.contextLine}
                  </div>
                  {frame.postContext?.map((line, j) => (
                    <div key={`post-${j}`} className="stack-context-line">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
