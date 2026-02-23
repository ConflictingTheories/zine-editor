import { useState, useReducer, useEffect } from "react";

// ─── TYPOGRAPHY & THEME ───────────────────────────────────────────────────────

const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #F5F0E8; color: #1A1410; }
  
  .playfair { font-family: 'Playfair Display', serif; }
  .playfair-italic { font-family: 'Playfair Display', serif; font-style: italic; }

  @keyframes slideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .toast { animation: slideUp 0.3s ease; }
  .card  { animation: fadeIn 0.4s ease both; }
  .card:nth-child(2) { animation-delay: 0.05s; }
  .card:nth-child(3) { animation-delay: 0.10s; }
  .card:nth-child(4) { animation-delay: 0.15s; }

  .progress-fill { transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: #C8862A !important;
    box-shadow: 0 0 0 3px rgba(200, 134, 42, 0.12);
  }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(26,20,16,0.10); border-color: #C8862A !important; }

  .blur-preview { filter: blur(4px); user-select: none; pointer-events: none; }
  .paywall-gradient {
    position: absolute; bottom: 0; left: 0; right: 0; height: 120px;
    background: linear-gradient(to bottom, transparent, #F5F0E8);
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D4C9B8; border-radius: 3px; }
`;

// ─── CREDIT TIER CONSTANTS ────────────────────────────────────────────────────

const CreditTier = {
  EXECUTIVE: "Executive Associate Producer",
  ASSOCIATE: "Associate Producer",
};

const EXECUTIVE_THRESHOLD = 0.2; // 20% of funding goal

// ─── ARTICLE DOMAIN LOGIC ─────────────────────────────────────────────────────

const isFunded = (article) =>
  article.fundingGoal === 0 || article.amountRaised >= article.fundingGoal;

const userHasAccess = (article, userId) =>
  isFunded(article) ||
  article.authorId === userId ||
  article.backers.some((b) => b.userId === userId);

const userContribution = (article, userId) =>
  article.backers
    .filter((b) => b.userId === userId)
    .reduce((total, b) => total + b.amount, 0);

const creditTierFor = (contribution, fundingGoal) => {
  if (!fundingGoal || !contribution) return null;
  return contribution / fundingGoal >= EXECUTIVE_THRESHOLD
    ? CreditTier.EXECUTIVE
    : CreditTier.ASSOCIATE;
};

const fundingPercent = (article) =>
  article.fundingGoal > 0
    ? Math.min((article.amountRaised / article.fundingGoal) * 100, 100)
    : 100;

const amountRemaining = (article) =>
  Math.max(0, article.fundingGoal - article.amountRaised);

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const INITIAL_USERS = [
  { id: "u1", name: "Alice Chen" },
  { id: "u2", name: "Marcus Webb" },
  { id: "u3", name: "Priya Nair" },
];

const INITIAL_ARTICLES = [
  {
    id: "a1",
    title: "The Hidden Economics of Open Source",
    excerpt:
      "How volunteer labor became the foundation of trillion-dollar companies — and why that might be unsustainable.",
    content:
      "Open source software powers virtually every major technology company on earth. The Linux kernel runs on 97% of the world's top supercomputers. Apache serves roughly a third of all web traffic. Yet the people who maintain these systems are often unpaid volunteers working in their spare time.\n\nThe problem is structural. A company can deploy an open source library saving millions in engineering costs, yet the library's maintainer fields bug reports at midnight while holding down a day job. The value flows in one direction.\n\nSeveral funding models have emerged: dual licensing charges commercial users while keeping the library free for individuals; sponsorship platforms allow direct developer support; companies like Red Hat have built successful businesses around enterprise support for open source cores.\n\nBut none of these fully solve the problem. The most critical infrastructure often has no commercial appeal, and therefore no funding path. The OpenSSL vulnerability that became Heartbleed — affecting millions of servers — was maintained by two developers, one of them part-time.\n\nWhat's needed is a different mental model: treating open source like public infrastructure. Roads don't need to generate revenue. They're funded because they create value for everyone. The same logic applies to the software underpinning the internet.",
    authorId: "u2",
    authorName: "Marcus Webb",
    fundingGoal: 50,
    amountRaised: 30,
    backers: [
      { userId: "u1", amount: 20, creditTier: CreditTier.ASSOCIATE },
      { userId: "u3", amount: 10, creditTier: CreditTier.ASSOCIATE },
    ],
    publishedAt: "Jan 15, 2025",
    tags: ["technology", "economics"],
  },
  {
    id: "a2",
    title: "Why Cities Keep Failing Public Transit",
    excerpt:
      "A structural analysis of the political and financial incentives that make world-class transit nearly impossible to build in America.",
    content:
      "Every decade, a new American city announces it will build a world-class transit system. Every decade, that system opens late, costs twice what was projected, and carries a fraction of expected ridership. This is not a coincidence.\n\nThe most obvious culprit is cost. American transit projects are uniquely expensive — the Second Avenue Subway cost over $2.5 billion per mile, roughly ten times comparable projects in Europe. Part of this is labor, but the larger driver is institutional: procurement rules and agencies structured to spend money rather than build effectively.\n\nThen there's the political economy of sprawl. American land use was designed around the car, and changing it threatens the property values of homeowners who vote in disproportionate numbers. Every proposed transit corridor faces organized opposition from exactly the people it would eventually serve.\n\nThe cities that have succeeded — Tokyo, Singapore, Hong Kong — share a key feature: their transit agencies capture land value. By owning development rights around stations, they profit from the property value increases that transit creates, using those profits to fund operations. American agencies hand that value to private developers.\n\nThe fix is not technical. It's political. Someone has to be willing to say that building the future is worth the friction of the present.",
    authorId: "u3",
    authorName: "Priya Nair",
    fundingGoal: 0,
    amountRaised: 0,
    backers: [],
    publishedAt: "Jan 20, 2025",
    tags: ["cities", "policy"],
  },
  {
    id: "a3",
    title: "The Craft of Deliberate Practice",
    excerpt:
      "The science of skill acquisition — and why most people spend thousands of hours practicing without getting meaningfully better.",
    content:
      "Anders Ericsson spent decades studying experts — chess grandmasters, concert pianists, elite athletes. His central finding was counterintuitive: the hours you put in matter far less than how you spend them. Most people practice wrong, and as a result, plateau far below their potential.\n\nThe key distinction is between naive and deliberate practice. Naive practice is repetition with the vague expectation that doing something many times will improve you. Deliberate practice requires a specific goal, immediate feedback, and working at the edge of current ability — in a zone of productive discomfort most people instinctively avoid.\n\nThis reframes how we think about talent. The 10,000-hour rule, as popularized by Gladwell's reading of Ericsson, is actually a misreading. Ericsson's finding was not that 10,000 hours produces expertise. It was that elite musicians had accumulated 10,000 hours of deliberate practice — qualitatively different from the casual playing their peers had done.\n\nThe mental representations experts build are the real product of deliberate practice. When a chess grandmaster sees a position, they perceive patterns, threats, and structures instantly — the result of years of feedback-driven refinement. This is true in every domain: expertise is pattern recognition at high speed.\n\nThe practical implication: practice what you cannot yet do. Build a tight feedback loop. Iterate. Most people rehearse what they already know. Experts train what they don't.",
    authorId: "u1",
    authorName: "Alice Chen",
    fundingGoal: 40,
    amountRaised: 40,
    backers: [
      { userId: "u2", amount: 25, creditTier: CreditTier.EXECUTIVE },
      { userId: "u3", amount: 15, creditTier: CreditTier.ASSOCIATE },
    ],
    publishedAt: "Jan 10, 2025",
    tags: ["learning", "psychology"],
  },
  {
    id: "a4",
    title: "The Philosophy of Attention",
    excerpt:
      "In an economy designed to capture our focus at any cost, what does it mean to truly pay attention?",
    content:
      "William James wrote in 1890 that 'the faculty of voluntarily bringing back a wandering attention, over and over again, is the very root of judgment, character, and will.' He could not have known he was describing the central crisis of the twenty-first century.\n\nOur devices are not neutral tools. They are engineered by teams of behavioral scientists to trigger compulsive use — variable reward schedules, social validation loops, infinite scroll. The average person touches their phone over 2,600 times a day. We are not failing at attention; we are being actively defeated by systems optimized to defeat us.\n\nSimone Weil, writing during World War II, described attention as 'the rarest and purest form of generosity.' To truly attend to something — a person, a problem, a piece of music — is to empty yourself of your own preoccupations and let the thing be what it is. This is hard. It requires the kind of stillness that modern life systematically prevents.\n\nThere is a paradox at the center of the attention economy: the more we try to do, the less we accomplish. Multitasking is not a feature; it is a myth. Cognitive switching costs are real, and they compound. The person who works on one thing for four uninterrupted hours consistently outperforms the person who works on four things for an hour each.\n\nThe philosopher's counsel is old and unchanged: find out what deserves your attention, and give it wholly. Everything else is distraction wearing the costume of productivity.",
    authorId: "u3",
    authorName: "Priya Nair",
    fundingGoal: 35,
    amountRaised: 5,
    backers: [{ userId: "u2", amount: 5, creditTier: CreditTier.ASSOCIATE }],
    publishedAt: "Feb 5, 2025",
    tags: ["philosophy", "culture"],
  },
];

const INITIAL_LIBRARIES = {
  u1: ["a1"],
  u2: ["a3", "a4"],
  u3: ["a1", "a3"],
};

// ─── STATE MANAGEMENT ─────────────────────────────────────────────────────────

const initialState = {
  articles: INITIAL_ARTICLES,
  users: INITIAL_USERS,
  libraries: INITIAL_LIBRARIES,
  currentUserId: "u1",
  view: "browse",
  selectedArticleId: null,
  notification: null,
};

function appReducer(state, action) {
  switch (action.type) {
    case "NAVIGATE":
      return {
        ...state,
        view: action.view,
        selectedArticleId: action.articleId ?? state.selectedArticleId,
      };

    case "SWITCH_USER":
      return { ...state, currentUserId: action.userId, view: "browse" };

    case "FUND_ARTICLE": {
      const { articleId, userId, amount } = action;
      const article = state.articles.find((a) => a.id === articleId);
      const prevContribution = userContribution(article, userId);
      const newContribution = prevContribution + amount;
      const newCreditTier = creditTierFor(newContribution, article.fundingGoal);

      const updatedBackers = article.backers.some((b) => b.userId === userId)
        ? article.backers.map((b) =>
            b.userId === userId
              ? { ...b, amount: b.amount + amount, creditTier: newCreditTier }
              : b
          )
        : [...article.backers, { userId, amount, creditTier: newCreditTier }];

      const updatedArticles = state.articles.map((a) =>
        a.id === articleId
          ? { ...a, amountRaised: a.amountRaised + amount, backers: updatedBackers }
          : a
      );

      const currentLibrary = state.libraries[userId] ?? [];
      const updatedLibrary = currentLibrary.includes(articleId)
        ? currentLibrary
        : [...currentLibrary, articleId];

      const wasJustFunded =
        !isFunded(article) && (article.amountRaised + amount) >= article.fundingGoal;

      return {
        ...state,
        articles: updatedArticles,
        libraries: { ...state.libraries, [userId]: updatedLibrary },
        notification: wasJustFunded
          ? "🎉 Article fully funded — now free for everyone. Your access is saved."
          : "Access granted — article added to your library.",
      };
    }

    case "PUBLISH_ARTICLE": {
      const author = state.users.find((u) => u.id === state.currentUserId);
      const newArticle = {
        ...action.article,
        id: `article-${Date.now()}`,
        authorId: state.currentUserId,
        authorName: author.name,
        amountRaised: 0,
        backers: [],
        publishedAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
      return {
        ...state,
        articles: [newArticle, ...state.articles],
        view: "article",
        selectedArticleId: newArticle.id,
        notification: "Article published.",
      };
    }

    case "CLEAR_NOTIFICATION":
      return { ...state, notification: null };

    default:
      return state;
  }
}

// ─── SHARED UI ATOMS ──────────────────────────────────────────────────────────

const S = {
  cream:  "#F5F0E8",
  ink:    "#1A1410",
  warm:   "#6B5E52",
  rule:   "#DDD5C5",
  gold:   "#C8862A",
  goldBg: "#FBF3E4",
  goldBd: "#E8D5A8",
  greenBg:"#E8F4EE",
  greenFg:"#2D6B4A",
  greenBd:"#B8D9C5",
  blueBg: "#E8EFF8",
  blueFg: "#2A5090",
  blueBd: "#B8CCE8",
  purpleBg:"#F0EBF8",
  purpleFg:"#5B3A9A",
  purpleBd:"#C8B0E8",
  red:    "#CC3333",
};

function Tag({ label }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px",
      background: "#EDE8DF", color: S.warm,
      borderRadius: 20, fontSize: 11, letterSpacing: "0.04em",
      fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    }}>
      {label}
    </span>
  );
}

function StatusBadge({ article }) {
  if (article.fundingGoal === 0)
    return <Pill bg={S.blueBg} fg={S.blueFg} bd={S.blueBd}>Free</Pill>;
  if (isFunded(article))
    return <Pill bg={S.greenBg} fg={S.greenFg} bd={S.greenBd}>Fully Funded</Pill>;
  return (
    <Pill bg={S.goldBg} fg={S.gold} bd={S.goldBd}>
      ${amountRemaining(article)} remaining
    </Pill>
  );
}

function CreditBadge({ tier }) {
  if (!tier) return null;
  const isExec = tier === CreditTier.EXECUTIVE;
  return (
    <Pill bg={isExec ? S.goldBg : S.purpleBg} fg={isExec ? "#8B5A10" : S.purpleFg} bd={isExec ? S.goldBd : S.purpleBd}>
      {isExec ? "★ " : ""}
      {tier}
    </Pill>
  );
}

function Pill({ bg, fg, bd, children }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px",
      background: bg, color: fg, border: `1px solid ${bd}`,
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.02em", whiteSpace: "nowrap",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {children}
    </span>
  );
}

function FundingBar({ article }) {
  const pct = fundingPercent(article);
  return (
    <div>
      <div style={{
        width: "100%", height: 4, background: S.rule,
        borderRadius: 2, overflow: "hidden",
      }}>
        <div className="progress-fill" style={{
          width: `${pct}%`, height: "100%",
          background: pct >= 100
            ? `linear-gradient(90deg, ${S.greenFg}, #4CAF7D)`
            : `linear-gradient(90deg, ${S.gold}, #E8A84A)`,
          borderRadius: 2,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 11, color: S.warm }}>
          ${article.amountRaised} raised
        </span>
        <span style={{ fontSize: 11, color: S.warm }}>
          goal: ${article.fundingGoal}
        </span>
      </div>
    </div>
  );
}

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast" style={{
      position: "fixed", bottom: 32, left: "50%",
      transform: "translateX(-50%)",
      background: S.ink, color: "#F5F0E8",
      padding: "12px 22px", borderRadius: 40,
      boxShadow: "0 8px 32px rgba(26,20,16,0.30)",
      fontSize: 13, display: "flex", alignItems: "center",
      gap: 10, zIndex: 9999, fontFamily: "'DM Sans', sans-serif",
      whiteSpace: "nowrap",
    }}>
      <span style={{ color: "#6DBE8A", fontSize: 14 }}>✓</span>
      <span>{message}</span>
      <button onClick={onDismiss} style={{
        background: "none", border: "none", color: "#7A6F66",
        cursor: "pointer", fontSize: 12, marginLeft: 4,
        padding: "0 2px",
      }}>✕</button>
    </div>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────

function Header({ users, currentUserId, view, dispatch }) {
  return (
    <header style={{
      background: S.cream, borderBottom: `1px solid ${S.rule}`,
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: 900, margin: "0 auto", padding: "0 24px",
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => dispatch({ type: "NAVIGATE", view: "browse" })}
          className="playfair"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 22, fontWeight: 700, color: S.ink, letterSpacing: "-0.02em",
          }}
        >
          Longform
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={() => dispatch({ type: "NAVIGATE", view: "library" })}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: view === "library" ? S.ink : S.warm,
              fontWeight: view === "library" ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
              transition: "color 0.15s",
            }}
          >
            Library
          </button>

          <button
            onClick={() => dispatch({ type: "NAVIGATE", view: "publish" })}
            style={{
              padding: "7px 18px",
              background: S.ink, color: S.cream,
              border: "none", borderRadius: 40, cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.15s",
            }}
          >
            Write
          </button>

          <select
            value={currentUserId}
            onChange={(e) => dispatch({ type: "SWITCH_USER", userId: e.target.value })}
            style={{
              fontSize: 13, color: S.ink,
              border: `1px solid ${S.rule}`, borderRadius: 40,
              padding: "6px 14px", background: "white", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </nav>
      </div>
    </header>
  );
}

// ─── BROWSE VIEW ──────────────────────────────────────────────────────────────

function ArticleCard({ article, currentUserId, onClick, index }) {
  const contribution = userContribution(article, currentUserId);
  const credit = creditTierFor(contribution, article.fundingGoal);
  const locked = !userHasAccess(article, currentUserId);

  return (
    <article
      onClick={onClick}
      className="card hover-lift"
      style={{
        background: "white", border: `1px solid ${S.rule}`,
        borderRadius: 16, padding: "24px 28px", cursor: "pointer",
        animationDelay: `${index * 0.06}s`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StatusBadge article={article} />
          {credit && <CreditBadge tier={credit} />}
        </div>
        {locked && article.fundingGoal > 0 && (
          <span style={{ fontSize: 14, color: "#C8C0B4", marginTop: 2 }}>🔒</span>
        )}
      </div>

      <h2 className="playfair" style={{
        fontSize: 17, fontWeight: 700, color: S.ink,
        lineHeight: 1.35, marginBottom: 8,
      }}>
        {article.title}
      </h2>

      <p style={{
        color: S.warm, fontSize: 13, lineHeight: 1.65,
        marginBottom: 14,
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {article.excerpt}
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {article.tags.map((tag) => <Tag key={tag} label={tag} />)}
      </div>

      {article.fundingGoal > 0 && !isFunded(article) && (
        <div style={{ marginBottom: 14 }}>
          <FundingBar article={article} />
        </div>
      )}

      <div style={{
        display: "flex", justifyContent: "space-between",
        paddingTop: 14, borderTop: `1px solid ${S.rule}`,
      }}>
        <span style={{ fontSize: 12, color: "#A8A098", fontStyle: "italic", fontFamily: "'Playfair Display', serif" }}>
          {article.authorName}
        </span>
        <span style={{ fontSize: 11, color: "#B8B0A4" }}>{article.publishedAt}</span>
      </div>
    </article>
  );
}

function BrowseView({ articles, currentUserId, dispatch }) {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: 36 }}>
        <h1 className="playfair" style={{
          fontSize: 36, fontWeight: 700, color: S.ink,
          marginBottom: 8, letterSpacing: "-0.02em",
        }}>
          Latest
        </h1>
        <p style={{ color: S.warm, fontSize: 14, lineHeight: 1.6, maxWidth: 480 }}>
          Fund articles to unlock them. Once fully funded, they become free for everyone.
          Contributors earn producer credits.
        </p>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16,
      }}>
        {articles.map((article, i) => (
          <ArticleCard
            key={article.id}
            article={article}
            currentUserId={currentUserId}
            index={i}
            onClick={() => dispatch({ type: "NAVIGATE", view: "article", articleId: article.id })}
          />
        ))}
      </div>
    </main>
  );
}

// ─── FUNDING PANEL ────────────────────────────────────────────────────────────

function FundingPanel({ article, currentUserId, dispatch }) {
  const [amount, setAmount] = useState("");
  const remaining = amountRemaining(article);
  const contribution = userContribution(article, currentUserId);
  const credit = creditTierFor(contribution, article.fundingGoal);
  const executiveMin = Math.ceil(article.fundingGoal * EXECUTIVE_THRESHOLD);
  const quickAmounts = [5, 10, 25].filter((a) => a < remaining);

  const handleFund = (val) => {
    const parsed = parseFloat(val);
    if (!parsed || parsed <= 0) return;
    dispatch({ type: "FUND_ARTICLE", articleId: article.id, userId: currentUserId, amount: parsed });
    setAmount("");
  };

  return (
    <div style={{
      background: S.goldBg, border: `1px solid ${S.goldBd}`,
      borderRadius: 16, padding: "24px 28px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3 className="playfair" style={{ fontSize: 18, color: S.ink, marginBottom: 4 }}>
            Fund this article
          </h3>
          <p style={{ fontSize: 12, color: S.warm }}>
            Any contribution grants immediate access
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="playfair" style={{ fontSize: 28, fontWeight: 700, color: S.gold, lineHeight: 1 }}>
            ${remaining}
          </div>
          <div style={{ fontSize: 11, color: S.warm, marginTop: 3 }}>still needed</div>
        </div>
      </div>

      <FundingBar article={article} />

      {contribution > 0 && (
        <div style={{
          marginTop: 12, padding: "8px 12px",
          background: "rgba(200,134,42,0.08)", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 12, color: S.warm }}>
            Your contribution: <strong>${contribution}</strong>
          </span>
          <CreditBadge tier={credit} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{
            position: "absolute", left: 14, top: "50%",
            transform: "translateY(-50%)",
            color: S.warm, fontSize: 14, pointerEvents: "none",
          }}>$</span>
          <input
            type="number"
            min="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFund(amount)}
            style={{
              width: "100%", padding: "10px 12px 10px 28px",
              border: `1px solid ${S.goldBd}`, borderRadius: 10,
              fontSize: 14, background: "white", color: S.ink,
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>
        <button
          onClick={() => handleFund(amount)}
          disabled={!amount || parseFloat(amount) <= 0}
          style={{
            padding: "10px 20px", background: S.ink, color: S.cream,
            border: "none", borderRadius: 10, cursor: "pointer",
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            fontFamily: "'DM Sans', sans-serif",
            opacity: (!amount || parseFloat(amount) <= 0) ? 0.4 : 1,
            transition: "opacity 0.15s",
          }}
        >
          Fund & Unlock
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {quickAmounts.map((a) => (
          <button key={a} onClick={() => handleFund(a)} style={{
            padding: "5px 12px", background: "white",
            border: `1px solid ${S.goldBd}`, borderRadius: 20,
            fontSize: 12, color: S.warm, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "border-color 0.15s, color 0.15s",
          }}>
            ${a}
          </button>
        ))}
        {remaining > 0 && (
          <button onClick={() => handleFund(remaining)} style={{
            padding: "5px 12px", background: "white",
            border: `1px solid ${S.gold}`, borderRadius: 20,
            fontSize: 12, color: S.gold, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          }}>
            Full ${remaining} — free it for everyone
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#A89880", marginTop: 12, lineHeight: 1.5 }}>
        Contribute ≥ ${executiveMin} total to earn{" "}
        <strong style={{ color: "#8B5A10" }}>Executive Associate Producer</strong>{" "}
        credit
      </p>
    </div>
  );
}

// ─── BACKERS LIST ─────────────────────────────────────────────────────────────

function BackersList({ article, users }) {
  if (article.backers.length === 0) return null;
  return (
    <div style={{
      borderTop: `1px solid ${S.rule}`, paddingTop: 24, marginTop: 32,
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: "#B8B0A4",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        Supported by
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {article.backers.map((backer) => {
          const user = users.find((u) => u.id === backer.userId);
          return (
            <div key={backer.userId} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{
                fontSize: 14, color: S.ink,
                fontFamily: "'Playfair Display', serif", fontStyle: "italic",
              }}>
                {user?.name ?? "Anonymous"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: S.warm }}>${backer.amount}</span>
                <CreditBadge tier={backer.creditTier} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ARTICLE VIEW ─────────────────────────────────────────────────────────────

function ArticleView({ article, currentUserId, users, dispatch }) {
  const canAccess = userHasAccess(article, currentUserId);
  const contribution = userContribution(article, currentUserId);
  const credit = creditTierFor(contribution, article.fundingGoal);
  const paragraphs = article.content.split("\n\n");
  const isAuthor = article.authorId === currentUserId;

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button
        onClick={() => dispatch({ type: "NAVIGATE", view: "browse" })}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 13, color: S.warm, display: "flex",
          alignItems: "center", gap: 6, marginBottom: 32,
          fontFamily: "'DM Sans', sans-serif",
          transition: "color 0.15s",
        }}
      >
        ← Back to all articles
      </button>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <StatusBadge article={article} />
        {credit && <CreditBadge tier={credit} />}
        {article.tags.map((tag) => <Tag key={tag} label={tag} />)}
      </div>

      <h1 className="playfair" style={{
        fontSize: 36, fontWeight: 700, color: S.ink,
        lineHeight: 1.25, marginBottom: 14, letterSpacing: "-0.02em",
      }}>
        {article.title}
      </h1>

      <p className="playfair-italic" style={{
        fontSize: 18, color: S.warm, lineHeight: 1.65, marginBottom: 20,
      }}>
        {article.excerpt}
      </p>

      <div style={{
        display: "flex", gap: 10, alignItems: "center",
        paddingBottom: 28, marginBottom: 28,
        borderBottom: `1px solid ${S.rule}`,
      }}>
        <span style={{
          fontSize: 14, color: S.ink,
          fontFamily: "'Playfair Display', serif", fontStyle: "italic",
        }}>
          {article.authorName}
        </span>
        <span style={{ color: S.rule }}>·</span>
        <span style={{ fontSize: 12, color: "#B8B0A4" }}>{article.publishedAt}</span>
        {isAuthor && (
          <>
            <span style={{ color: S.rule }}>·</span>
            <Pill bg="#E8F0F8" fg="#3A5580" bd="#C0D0E8">Your article</Pill>
          </>
        )}
      </div>

      {canAccess ? (
        <div>
          {paragraphs.map((p, i) => (
            <p key={i} style={{
              color: "#2C2620", fontSize: 16, lineHeight: 1.85,
              marginBottom: 22, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
            }}>
              {p}
            </p>
          ))}

          {!isFunded(article) && !isAuthor && (
            <div style={{ marginTop: 40 }}>
              <p style={{ fontSize: 13, color: S.warm, marginBottom: 16, fontStyle: "italic" }}>
                Enjoyed it? Help fund this article so it becomes free for everyone.
              </p>
              <FundingPanel
                article={article}
                currentUserId={currentUserId}
                dispatch={dispatch}
              />
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{
            color: "#2C2620", fontSize: 16, lineHeight: 1.85,
            marginBottom: 22, fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
          }}>
            {paragraphs[0]}
          </p>

          <div style={{ position: "relative", marginBottom: 32 }}>
            <div className="blur-preview">
              {paragraphs.slice(1, 3).map((p, i) => (
                <p key={i} style={{
                  color: "#2C2620", fontSize: 16, lineHeight: 1.85,
                  marginBottom: 22, fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                }}>
                  {p}
                </p>
              ))}
            </div>
            <div className="paywall-gradient" />
          </div>

          <FundingPanel
            article={article}
            currentUserId={currentUserId}
            dispatch={dispatch}
          />
        </div>
      )}

      <BackersList article={article} users={users} />
    </main>
  );
}

// ─── LIBRARY VIEW ─────────────────────────────────────────────────────────────

function LibraryView({ articles, libraries, currentUserId, users, dispatch }) {
  const libraryIds = libraries[currentUserId] ?? [];
  const libraryArticles = articles.filter((a) => libraryIds.includes(a.id));
  const currentUser = users.find((u) => u.id === currentUserId);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: 36 }}>
        <h1 className="playfair" style={{
          fontSize: 36, fontWeight: 700, color: S.ink,
          marginBottom: 6, letterSpacing: "-0.02em",
        }}>
          {currentUser.name}'s Library
        </h1>
        <p style={{ color: S.warm, fontSize: 13 }}>
          {libraryArticles.length} article{libraryArticles.length !== 1 ? "s" : ""}
        </p>
      </div>

      {libraryArticles.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 0", color: "#C0B8B0",
        }}>
          <div className="playfair" style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
            ○
          </div>
          <p style={{ fontSize: 16, marginBottom: 6, color: S.warm }}>Your library is empty</p>
          <p style={{ fontSize: 13, color: "#B8B0A4", marginBottom: 24 }}>
            Fund an article to unlock it and add it to your collection.
          </p>
          <button
            onClick={() => dispatch({ type: "NAVIGATE", view: "browse" })}
            style={{
              padding: "10px 22px", background: S.ink, color: S.cream,
              border: "none", borderRadius: 40, cursor: "pointer",
              fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Browse articles
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16,
        }}>
          {libraryArticles.map((article, i) => {
            const contribution = userContribution(article, currentUserId);
            const credit = creditTierFor(contribution, article.fundingGoal);
            return (
              <article
                key={article.id}
                onClick={() => dispatch({ type: "NAVIGATE", view: "article", articleId: article.id })}
                className="card hover-lift"
                style={{
                  background: "white", border: `1px solid ${S.rule}`,
                  borderRadius: 16, padding: "24px 28px", cursor: "pointer",
                  animationDelay: `${i * 0.06}s`,
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {credit && <CreditBadge tier={credit} />}
                  <StatusBadge article={article} />
                </div>
                <h3 className="playfair" style={{
                  fontSize: 17, fontWeight: 700, color: S.ink,
                  lineHeight: 1.35, marginBottom: 8,
                }}>
                  {article.title}
                </h3>
                <p style={{
                  color: S.warm, fontSize: 13, lineHeight: 1.55,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {article.excerpt}
                </p>
                <p style={{
                  fontSize: 12, color: "#B8B0A4", marginTop: 14,
                  fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                }}>
                  {article.authorName} · {article.publishedAt}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ─── PUBLISH VIEW ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT = { title: "", excerpt: "", content: "", tags: "", fundingGoal: "" };

function PublishView({ dispatch }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [isFree, setIsFree] = useState(false);
  const [errors, setErrors] = useState({});

  const update = (field) => (e) =>
    setDraft((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!draft.title.trim()) errs.title = "Required";
    if (!draft.content.trim()) errs.content = "Required";
    if (!isFree && (!draft.fundingGoal || parseFloat(draft.fundingGoal) <= 0)) {
      errs.fundingGoal = "Set a goal, or mark as free";
    }
    return errs;
  };

  const handlePublish = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    dispatch({
      type: "PUBLISH_ARTICLE",
      article: {
        title: draft.title.trim(),
        excerpt: draft.excerpt.trim() || draft.content.trim().slice(0, 130) + "…",
        content: draft.content.trim(),
        tags: draft.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        fundingGoal: isFree ? 0 : parseFloat(draft.fundingGoal),
      },
    });
  };

  const inputStyle = (field) => ({
    width: "100%", padding: "11px 14px",
    border: `1px solid ${errors[field] ? S.red : S.rule}`,
    borderRadius: 10, fontSize: 14, color: S.ink,
    background: "white", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: S.warm, marginBottom: 8, letterSpacing: "0.04em",
    textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <main style={{ maxWidth: 660, margin: "0 auto", padding: "48px 24px 80px" }}>
      <h1 className="playfair" style={{
        fontSize: 36, fontWeight: 700, color: S.ink,
        marginBottom: 32, letterSpacing: "-0.02em",
      }}>
        Publish an Article
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        <div>
          <label style={labelStyle}>Title</label>
          <input type="text" value={draft.title} onChange={update("title")}
            placeholder="Your article title"
            style={{ ...inputStyle("title"), fontSize: 16, fontFamily: "'Playfair Display', serif" }}
          />
          {errors.title && <p style={{ color: S.red, fontSize: 11, marginTop: 4 }}>{errors.title}</p>}
        </div>

        <div>
          <label style={labelStyle}>
            Excerpt <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
          </label>
          <textarea rows={2} value={draft.excerpt} onChange={update("excerpt")}
            placeholder="A one-sentence description — auto-generated if left blank"
            style={{ ...inputStyle("excerpt"), resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        <div>
          <label style={labelStyle}>Content</label>
          <textarea rows={14} value={draft.content} onChange={update("content")}
            placeholder={"Write your article here.\n\nSeparate paragraphs with a blank line."}
            style={{ ...inputStyle("content"), resize: "vertical", lineHeight: 1.75, fontWeight: 300 }}
          />
          {errors.content && <p style={{ color: S.red, fontSize: 11, marginTop: 4 }}>{errors.content}</p>}
        </div>

        <div>
          <label style={labelStyle}>
            Tags <span style={{ fontWeight: 400, textTransform: "none" }}>(comma-separated)</span>
          </label>
          <input type="text" value={draft.tags} onChange={update("tags")}
            placeholder="e.g. technology, culture, science"
            style={inputStyle("tags")}
          />
        </div>

        <div style={{
          background: S.goldBg, border: `1px solid ${S.goldBd}`,
          borderRadius: 14, padding: "22px 24px",
        }}>
          <h3 className="playfair" style={{ fontSize: 18, color: S.ink, marginBottom: 16 }}>
            Monetization
          </h3>

          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer", marginBottom: 16, userSelect: "none",
          }}>
            <input type="checkbox" checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: S.gold }}
            />
            <span style={{ fontSize: 14, color: S.ink }}>
              Publish as free — no funding goal required
            </span>
          </label>

          {!isFree && (
            <div>
              <label style={labelStyle}>Funding Goal ($)</label>
              <p style={{ fontSize: 12, color: S.warm, marginBottom: 10, lineHeight: 1.5 }}>
                Readers pay to unlock access. Once the goal is reached, the article
                becomes free for everyone. Contributors earn producer credits.
              </p>
              <input type="number" min="1" value={draft.fundingGoal}
                onChange={update("fundingGoal")} placeholder="e.g. 50"
                style={{ ...inputStyle("fundingGoal"), maxWidth: 160 }}
              />
              {errors.fundingGoal && (
                <p style={{ color: S.red, fontSize: 11, marginTop: 4 }}>{errors.fundingGoal}</p>
              )}
              {draft.fundingGoal && parseFloat(draft.fundingGoal) > 0 && (
                <p style={{ fontSize: 12, color: "#8B7060", marginTop: 10, lineHeight: 1.5 }}>
                  Contributors paying ≥ ${Math.ceil(parseFloat(draft.fundingGoal) * EXECUTIVE_THRESHOLD)} total
                  earn{" "}
                  <strong style={{ color: "#8B5A10" }}>Executive Associate Producer</strong>{" "}
                  credit
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 4 }}>
          <button onClick={handlePublish} style={{
            padding: "12px 28px", background: S.ink, color: S.cream,
            border: "none", borderRadius: 40, cursor: "pointer",
            fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}>
            Publish Article
          </button>
          <button
            onClick={() => dispatch({ type: "NAVIGATE", view: "browse" })}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: S.warm, fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { articles, users, libraries, currentUserId, view, selectedArticleId, notification } = state;

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  return (
    <div style={{ minHeight: "100vh", background: S.cream }}>
      <style>{FONT_IMPORT}</style>

      <Header users={users} currentUserId={currentUserId} view={view} dispatch={dispatch} />

      {view === "browse" && (
        <BrowseView articles={articles} currentUserId={currentUserId} dispatch={dispatch} />
      )}

      {view === "article" && selectedArticle && (
        <ArticleView
          article={selectedArticle}
          currentUserId={currentUserId}
          users={users}
          dispatch={dispatch}
        />
      )}

      {view === "library" && (
        <LibraryView
          articles={articles}
          libraries={libraries}
          currentUserId={currentUserId}
          users={users}
          dispatch={dispatch}
        />
      )}

      {view === "publish" && (
        <PublishView dispatch={dispatch} />
      )}

      {notification && (
        <Toast
          message={notification}
          onDismiss={() => dispatch({ type: "CLEAR_NOTIFICATION" })}
        />
      )}
    </div>
  );
}
