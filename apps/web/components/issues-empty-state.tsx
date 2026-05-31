import Link from "next/link";

export function IssuesEmptyState() {
  return (
    <div className="issues-empty-state">
      <div className="issues-empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="100" cy="145" rx="70" ry="8" fill="currentColor" opacity="0.08" />
          <path
            d="M30 120 Q50 100 70 115 T110 110 T150 118 T170 120"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.15"
            fill="none"
          />
          <rect x="55" y="55" width="50" height="40" rx="6" fill="#6E56CF" opacity="0.9" />
          <rect x="62" y="62" width="36" height="26" rx="3" fill="#1C1B2E" />
          <circle cx="74" cy="72" r="3" fill="#EBEAEF" />
          <circle cx="86" cy="72" r="3" fill="#EBEAEF" />
          <path d="M70 80 Q80 84 90 80" stroke="#EBEAEF" strokeWidth="1.5" fill="none" />
          <rect x="72" y="95" width="16" height="20" rx="2" fill="#6E56CF" opacity="0.7" />
          <rect x="90" y="95" width="16" height="20" rx="2" fill="#6E56CF" opacity="0.7" />
          <path
            d="M105 70 L130 55 L135 60 L110 78 Z"
            fill="#C4A882"
            opacity="0.8"
          />
          <line x1="130" y1="55" x2="130" y2="115" stroke="#C4A882" strokeWidth="2" />
          <circle cx="130" cy="50" r="8" fill="#E8A87C" opacity="0.9" />
          <path
            d="M40 100 L55 85 L60 90 L45 105 Z"
            fill="#4A6741"
            opacity="0.5"
          />
          <path
            d="M155 95 L168 80 L173 85 L160 100 Z"
            fill="#4A6741"
            opacity="0.4"
          />
        </svg>
      </div>
      <div className="issues-empty-content">
        <h2>No issues match your search</h2>
        <p className="issues-empty-sub">
          If this is unexpected, check out these tips:
        </p>
        <ul className="issues-empty-tips">
          <li>Double-check your project and environment filters</li>
          <li>
            Make sure your SDK is configured with the correct{" "}
            <Link href="/docs/overview">DSN</Link>
          </li>
          <li>Send a test error from your application to verify the pipeline</li>
        </ul>
      </div>
    </div>
  );
}
