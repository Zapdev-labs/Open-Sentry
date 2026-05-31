interface PageHeaderBarProps {
  title: string;
  children?: React.ReactNode;
}

export function PageHeaderBar({ title, children }: PageHeaderBarProps) {
  return (
    <header className="dash-page-header">
      <h1 className="dash-page-title">{title}</h1>
      {children && <div className="dash-page-actions">{children}</div>}
    </header>
  );
}
