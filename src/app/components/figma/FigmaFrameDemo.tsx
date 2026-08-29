const quickActions = [
  { label: "Income", value: "+₹18.2k", tone: "income" },
  { label: "Budget", value: "₹54k", tone: "neutral" },
  { label: "Goals", value: "12", tone: "accent" },
];

const transactions = [
  { name: "Salary", type: "income", amount: "+₹42,500", time: "Today, 9:30 AM" },
  { name: "Rent", type: "expense", amount: "-₹18,000", time: "Today, 7:15 AM" },
  { name: "Airtel", type: "expense", amount: "-₹799", time: "Yesterday" },
  { name: "Freelance", type: "income", amount: "+₹12,200", time: "Yesterday" },
];

export function FigmaFrameDemo() {
  return (
    <div className="figma-demo-shell">
      <div className="figma-demo-browser-bar">
        <div className="figma-demo-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="figma-demo-address">livesync.ai/dashboard</div>
      </div>

      <div className="figma-phone-frame">
        <div className="figma-notch" />

        <header className="figma-header">
          <div>
            <p className="eyebrow">Good morning</p>
            <h1>Hi, Nitesh</h1>
          </div>
          <button className="figma-avatar" aria-label="Profile">N</button>
        </header>

        <main className="figma-main">
          <section className="figma-hero-card">
            <div className="figma-hero-topline">
              <span>Financial health</span>
              <span className="figma-pill success">Excellent</span>
            </div>

            <div className="figma-balance-row">
              <div>
                <p className="muted-label">Net worth</p>
                <h2>₹8,42,600</h2>
              </div>
              <div className="trend positive">+12.4%</div>
            </div>

            <div className="figma-bars" aria-label="Balance trend chart">
              {[28, 40, 32, 58, 62, 54, 76, 69, 83, 96].map((height, idx) => (
                <span key={idx} style={{ height: `${height}%` }} />
              ))}
            </div>
          </section>

          <section className="figma-quick-actions">
            {quickActions.map((action) => (
              <div key={action.label} className={`quick-action ${action.tone}`}>
                <span>{action.label}</span>
                <strong>{action.value}</strong>
              </div>
            ))}
          </section>

          <section className="figma-card spend-card">
            <div className="card-head">
              <div>
                <p className="muted-label">Monthly cash flow</p>
                <h3>₹94,720</h3>
              </div>
              <button className="ghost-button">View</button>
            </div>

            <div className="figma-donut-wrap">
              <div className="donut-chart">
                <div className="donut-center">
                  <span>72%</span>
                </div>
              </div>
              <div className="legend-list">
                <div><span className="dot dot-green" /> Invested</div>
                <div><span className="dot dot-blue" /> Savings</div>
                <div><span className="dot dot-orange" /> Spend</div>
              </div>
            </div>
          </section>

          <section className="figma-card listing-card">
            <div className="card-head">
              <div>
                <p className="muted-label">Recent activity</p>
                <h3>Transactions</h3>
              </div>
              <button className="ghost-button">All</button>
            </div>

            <div className="transaction-list">
              {transactions.map((item) => (
                <div className="transaction-item" key={`${item.name}-${item.time}`}>
                  <div className={`transaction-icon ${item.type}`}>
                    {item.type === "income" ? "+" : "-"}
                  </div>
                  <div className="transaction-copy">
                    <strong>{item.name}</strong>
                    <span>{item.time}</span>
                  </div>
                  <div className={`transaction-amount ${item.type}`}>{item.amount}</div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
