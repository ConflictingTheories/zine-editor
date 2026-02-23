import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { fetchArticles, fetchArticle, fetchLibrary, publishArticle } from "./api/articles.js";
import FundingPanel from "./components/FundingPanel.jsx";
import {
  formatMicro,
  dollarsToMicro,
  fundingPercent,
  remainingMicro,
} from "./utils/currency.js";

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  cream: "#F5F0E8", ink: "#1A1410", warm: "#6B5E52",
  rule:  "#DDD5C5", gold: "#C8862A", goldBg: "#FBF3E4",
  goldBd:"#E8D5A8", green: "#2D6B4A", greenBg: "#E8F4EE",
  red:   "#CC3333",
};

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: ${S.cream}; color: ${S.ink}; }
@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
.card { animation: fadeIn 0.35s ease both; }
.card:nth-child(2){animation-delay:.05s} .card:nth-child(3){animation-delay:.1s} .card:nth-child(4){animation-delay:.15s}
.toast { animation: slideUp 0.3s ease; }
input:focus,textarea:focus,select:focus { outline:none; border-color:${S.gold}!important; box-shadow:0 0 0 3px rgba(200,134,42,.12); }
input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
.hover-lift { transition: transform .2s, box-shadow .2s, border-color .2s; }
.hover-lift:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(26,20,16,.10); border-color:${S.gold}!important; }`;

// ── Shared atoms ──────────────────────────────────────────────────────────────

function Pill({ bg, fg, bd, children }) {
  return (
    <span style={{
      display:"inline-block", padding:"3px 10px",
      background:bg, color:fg, border:`1px solid ${bd}`,
      borderRadius:20, fontSize:11, fontWeight:600,
      letterSpacing:"0.02em", whiteSpace:"nowrap",
      fontFamily:"'DM Sans', sans-serif",
    }}>{children}</span>
  );
}

function FundingBar({ article }) {
  const pct    = fundingPercent(article.funding_goal_micro, article.amount_raised_micro);
  const funded = article.funding_goal_micro === 0 || article.amount_raised_micro >= article.funding_goal_micro;
  return (
    <div>
      <div style={{ width:"100%", height:4, background:S.rule, borderRadius:2, overflow:"hidden" }}>
        <div style={{
          width:`${pct}%`, height:"100%", borderRadius:2,
          background: funded
            ? `linear-gradient(90deg,${S.green},#4CAF7D)`
            : `linear-gradient(90deg,${S.gold},#E8A84A)`,
          transition:"width 0.6s ease",
        }} />
      </div>
      {article.funding_goal_micro > 0 && (
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
          <span style={{ fontSize:11, color:S.warm }}>{formatMicro(article.amount_raised_micro)} raised</span>
          <span style={{ fontSize:11, color:S.warm }}>goal: {formatMicro(article.funding_goal_micro)}</span>
        </div>
      )}
    </div>
  );
}

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);
  return (
    <div className="toast" style={{
      position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)",
      background:S.ink, color:"#F5F0E8", padding:"12px 22px", borderRadius:40,
      boxShadow:"0 8px 32px rgba(26,20,16,.30)", fontSize:13,
      display:"flex", alignItems:"center", gap:10, zIndex:9999,
      fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap",
    }}>
      <span style={{ color:"#6DBE8A" }}>✓</span>
      <span>{message}</span>
      <button onClick={onDismiss} style={{
        background:"none", border:"none", color:"#7A6F66",
        cursor:"pointer", fontSize:12, marginLeft:4,
      }}>✕</button>
    </div>
  );
}

// ── Auth modal ────────────────────────────────────────────────────────────────
function AuthModal({ onLogin, onRegister }) {
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [busy,     setBusy]     = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === "login") await onLogin({ email, password });
      else                  await onRegister({ email, name, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (label, value, setValue, type = "text") => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:600, color:S.warm,
        letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6,
        fontFamily:"'DM Sans', sans-serif" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ width:"100%", padding:"10px 14px",
          border:`1px solid ${S.rule}`, borderRadius:10, fontSize:14,
          fontFamily:"'DM Sans', sans-serif", background:"white" }} />
    </div>
  );

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(26,20,16,.5)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000,
    }}>
      <div style={{
        background:"white", borderRadius:20, padding:"36px 40px",
        width:"100%", maxWidth:400, boxShadow:"0 24px 64px rgba(26,20,16,.2)",
      }}>
        <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26,
          color:S.ink, marginBottom:24, letterSpacing:"-0.02em" }}>
          {mode === "login" ? "Sign in" : "Create account"}
        </h2>

        {error && <p style={{ color:S.red, fontSize:13, marginBottom:14 }}>{error}</p>}

        {field("Email", email, setEmail, "email")}
        {mode === "register" && field("Name", name, setName)}
        {field("Password", password, setPassword, "password")}

        <button onClick={submit} disabled={busy} style={{
          width:"100%", padding:"12px", background:busy ? "#555" : S.ink,
          color:"#F5F0E8", border:"none", borderRadius:40, fontSize:14,
          fontWeight:600, cursor:busy ? "default" : "pointer",
          fontFamily:"'DM Sans', sans-serif", marginTop:8,
        }}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p style={{ fontSize:13, color:S.warm, marginTop:16, textAlign:"center" }}>
          {mode === "login" ? "No account? " : "Already have one? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            style={{ background:"none", border:"none", color:S.gold, cursor:"pointer",
              fontSize:13, fontWeight:600 }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ user, view, onNavigate, onShowAuth, onLogout }) {
  return (
    <header style={{ background:S.cream, borderBottom:`1px solid ${S.rule}`,
      position:"sticky", top:0, zIndex:100 }}>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 24px",
        height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={() => onNavigate("browse")} style={{
          background:"none", border:"none", cursor:"pointer",
          fontSize:22, fontWeight:700, color:S.ink, letterSpacing:"-0.02em",
          fontFamily:"'Playfair Display', serif",
        }}>Longform</button>

        <nav style={{ display:"flex", alignItems:"center", gap:20 }}>
          {user && (
            <button onClick={() => onNavigate("library")} style={{
              background:"none", border:"none", cursor:"pointer", fontSize:13,
              color: view === "library" ? S.ink : S.warm,
              fontWeight: view === "library" ? 600 : 400,
              fontFamily:"'DM Sans', sans-serif",
            }}>Library</button>
          )}
          {user && (
            <button onClick={() => onNavigate("publish")} style={{
              padding:"7px 18px", background:S.ink, color:S.cream,
              border:"none", borderRadius:40, cursor:"pointer",
              fontSize:13, fontWeight:500, fontFamily:"'DM Sans', sans-serif",
            }}>Write</button>
          )}
          {user ? (
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:13, color:S.warm }}>{user.name}</span>
              <button onClick={onLogout} style={{
                background:"none", border:`1px solid ${S.rule}`, borderRadius:40,
                padding:"5px 14px", fontSize:12, color:S.warm, cursor:"pointer",
                fontFamily:"'DM Sans', sans-serif",
              }}>Sign out</button>
            </div>
          ) : (
            <button onClick={onShowAuth} style={{
              padding:"7px 18px", background:"none",
              border:`1px solid ${S.rule}`, borderRadius:40, cursor:"pointer",
              fontSize:13, color:S.ink, fontFamily:"'DM Sans', sans-serif",
            }}>Sign in</button>
          )}
        </nav>
      </div>
    </header>
  );
}

// ── Browse view ───────────────────────────────────────────────────────────────
function BrowseView({ user, onNavigate, onShowAuth }) {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    fetchArticles()
      .then((data) => setArticles(data.articles))
      .catch((err)  => setError(err.message))
      .finally(()   => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} />;

  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"48px 24px" }}>
      <div style={{ marginBottom:36 }}>
        <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:36,
          fontWeight:700, color:S.ink, marginBottom:8, letterSpacing:"-0.02em" }}>
          Latest
        </h1>
        <p style={{ color:S.warm, fontSize:14, lineHeight:1.6, maxWidth:480 }}>
          Fund articles to unlock them. Once fully funded, they become free for everyone.
          Contributors earn producer credits.
        </p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))", gap:16 }}>
        {articles.map((article, i) => (
          <ArticleCard key={article.id} article={article} index={i}
            onClick={() => onNavigate("article", article.id)} />
        ))}
      </div>
    </main>
  );
}

function ArticleCard({ article, onClick, index }) {
  const funded = article.is_funded;
  const locked = !article.user_access;

  return (
    <article onClick={onClick} className="card hover-lift" style={{
      background:"white", border:`1px solid ${S.rule}`,
      borderRadius:16, padding:"24px 28px", cursor:"pointer",
      animationDelay:`${index * 0.06}s`,
    }}>
      <div style={{ display:"flex", alignItems:"flex-start",
        justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {article.funding_goal_micro === 0
            ? <Pill bg="#E8EFF8" fg="#2A5090" bd="#B8CCE8">Free</Pill>
            : funded
              ? <Pill bg={S.greenBg} fg={S.green} bd="#B8D9C5">Fully Funded</Pill>
              : <Pill bg={S.goldBg} fg={S.gold} bd={S.goldBd}>
                  {formatMicro(remainingMicro(article.funding_goal_micro, article.amount_raised_micro))} remaining
                </Pill>
          }
          {article.credit_tier && (
            <Pill
              bg={article.credit_tier === "Executive Associate Producer" ? S.goldBg : "#F0EBF8"}
              fg={article.credit_tier === "Executive Associate Producer" ? "#8B5A10" : "#5B3A9A"}
              bd={article.credit_tier === "Executive Associate Producer" ? S.goldBd : "#C8B0E8"}
            >
              {article.credit_tier === "Executive Associate Producer" ? "★ " : ""}{article.credit_tier}
            </Pill>
          )}
        </div>
        {locked && article.funding_goal_micro > 0 && (
          <span style={{ fontSize:14, color:"#C8C0B4" }}>🔒</span>
        )}
      </div>

      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:17,
        fontWeight:700, color:S.ink, lineHeight:1.35, marginBottom:8 }}>
        {article.title}
      </h2>
      <p style={{ color:S.warm, fontSize:13, lineHeight:1.65, marginBottom:14,
        display:"-webkit-box", WebkitLineClamp:2,
        WebkitBoxOrient:"vertical", overflow:"hidden" }}>
        {article.excerpt}
      </p>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {article.tags.map((t) => (
          <span key={t} style={{ display:"inline-block", padding:"2px 10px",
            background:"#EDE8DF", color:S.warm, borderRadius:20,
            fontSize:11, fontFamily:"'DM Sans', sans-serif" }}>{t}</span>
        ))}
      </div>

      {article.funding_goal_micro > 0 && !funded && (
        <div style={{ marginBottom:14 }}><FundingBar article={article} /></div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between",
        paddingTop:14, borderTop:`1px solid ${S.rule}` }}>
        <span style={{ fontSize:12, color:"#A8A098",
          fontFamily:"'Playfair Display', serif", fontStyle:"italic" }}>
          {article.author_name}
        </span>
        <span style={{ fontSize:11, color:"#B8B0A4" }}>
          {new Date(article.published_at).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
        </span>
      </div>
    </article>
  );
}

// ── Article view ──────────────────────────────────────────────────────────────
function ArticleView({ articleId, user, onNavigate, onShowAuth, onNotify }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchArticle(articleId)
      .then((data) => setArticle(data.article))
      .catch((err)  => setError(err.message))
      .finally(()   => setLoading(false));
  }, [articleId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} />;
  if (!article) return null;

  const isFunded  = article.is_funded;
  const isAuthor  = user?.id === article.author_id;
  const paragraphs = article.content.split("\n\n");

  const handleFunded = () => {
    onNotify("Access granted — article added to your library.");
    load(); // re-fetch to get updated article state
  };

  return (
    <main style={{ maxWidth:680, margin:"0 auto", padding:"40px 24px 80px" }}>
      <button onClick={() => onNavigate("browse")} style={{
        background:"none", border:"none", cursor:"pointer", fontSize:13,
        color:S.warm, display:"flex", alignItems:"center", gap:6, marginBottom:32,
        fontFamily:"'DM Sans', sans-serif",
      }}>← Back</button>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {article.funding_goal_micro === 0
          ? <Pill bg="#E8EFF8" fg="#2A5090" bd="#B8CCE8">Free</Pill>
          : isFunded
            ? <Pill bg={S.greenBg} fg={S.green} bd="#B8D9C5">Fully Funded</Pill>
            : <Pill bg={S.goldBg} fg={S.gold} bd={S.goldBd}>
                {formatMicro(remainingMicro(article.funding_goal_micro, article.amount_raised_micro))} remaining
              </Pill>
        }
        {article.credit_tier && (
          <Pill bg={S.goldBg} fg="#8B5A10" bd={S.goldBd}>{article.credit_tier}</Pill>
        )}
        {article.tags.map((t) => (
          <span key={t} style={{ display:"inline-block", padding:"2px 10px",
            background:"#EDE8DF", color:S.warm, borderRadius:20, fontSize:11 }}>{t}</span>
        ))}
      </div>

      <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:36,
        fontWeight:700, color:S.ink, lineHeight:1.25, marginBottom:14,
        letterSpacing:"-0.02em" }}>{article.title}</h1>

      <p style={{ fontFamily:"'Playfair Display', serif", fontStyle:"italic",
        fontSize:18, color:S.warm, lineHeight:1.65, marginBottom:20 }}>
        {article.excerpt}
      </p>

      <div style={{ display:"flex", gap:10, alignItems:"center",
        paddingBottom:28, marginBottom:28, borderBottom:`1px solid ${S.rule}` }}>
        <span style={{ fontSize:14, color:S.ink,
          fontFamily:"'Playfair Display', serif", fontStyle:"italic" }}>
          {article.author_name}
        </span>
        <span style={{ color:S.rule }}>·</span>
        <span style={{ fontSize:12, color:"#B8B0A4" }}>
          {new Date(article.published_at).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}
        </span>
      </div>

      {!article.locked ? (
        <div>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ color:"#2C2620", fontSize:16, lineHeight:1.85,
              marginBottom:22, fontWeight:300 }}>{p}</p>
          ))}
          {!isFunded && !isAuthor && article.funding_goal_micro > 0 && (
            <div style={{ marginTop:40 }}>
              <p style={{ fontSize:13, color:S.warm, marginBottom:16, fontStyle:"italic" }}>
                Enjoyed it? Help fund this article so it becomes free for everyone.
              </p>
              <FundingPanel article={article} onFunded={handleFunded} />
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color:"#2C2620", fontSize:16, lineHeight:1.85, marginBottom:22, fontWeight:300 }}>
            {paragraphs[0]}
          </p>
          <div style={{ position:"relative", marginBottom:32 }}>
            <div style={{ filter:"blur(4px)", userSelect:"none", pointerEvents:"none" }}>
              {paragraphs.slice(1, 3).map((p, i) => (
                <p key={i} style={{ color:"#2C2620", fontSize:16, lineHeight:1.85,
                  marginBottom:22, fontWeight:300 }}>{p}</p>
              ))}
            </div>
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:120,
              background:`linear-gradient(to bottom, transparent, ${S.cream})` }} />
          </div>
          {user
            ? <FundingPanel article={article} onFunded={handleFunded} />
            : (
              <div style={{ textAlign:"center", padding:"32px 0" }}>
                <p style={{ color:S.warm, marginBottom:16, fontSize:14 }}>
                  Sign in to fund and unlock this article
                </p>
                <button onClick={onShowAuth} style={{
                  padding:"11px 28px", background:S.ink, color:S.cream,
                  border:"none", borderRadius:40, cursor:"pointer",
                  fontSize:14, fontWeight:600, fontFamily:"'DM Sans', sans-serif",
                }}>Sign in to fund</button>
              </div>
            )
          }
        </div>
      )}

      {article.backers?.length > 0 && (
        <div style={{ borderTop:`1px solid ${S.rule}`, paddingTop:24, marginTop:32 }}>
          <p style={{ fontSize:10, fontWeight:700, color:"#B8B0A4",
            letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:14 }}>
            Supported by
          </p>
          {article.backers.map((b) => (
            <div key={b.user_id} style={{ display:"flex", alignItems:"center",
              justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontSize:14, color:S.ink,
                fontFamily:"'Playfair Display', serif", fontStyle:"italic" }}>
                {b.name}
              </span>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:12, color:S.warm }}>{formatMicro(b.total_micro)}</span>
                <Pill
                  bg={b.credit_tier === "Executive Associate Producer" ? S.goldBg : "#F0EBF8"}
                  fg={b.credit_tier === "Executive Associate Producer" ? "#8B5A10" : "#5B3A9A"}
                  bd={b.credit_tier === "Executive Associate Producer" ? S.goldBd : "#C8B0E8"}
                >{b.credit_tier}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ── Library view ──────────────────────────────────────────────────────────────
function LibraryView({ user, onNavigate }) {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetchLibrary()
      .then((data) => setArticles(data.articles))
      .finally(()  => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"48px 24px" }}>
      <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:36,
        fontWeight:700, color:S.ink, marginBottom:6, letterSpacing:"-0.02em" }}>
        {user.name}'s Library
      </h1>
      <p style={{ color:S.warm, fontSize:13, marginBottom:32 }}>
        {articles.length} article{articles.length !== 1 ? "s" : ""}
      </p>

      {articles.length === 0 ? (
        <div style={{ textAlign:"center", padding:"64px 0" }}>
          <p style={{ fontSize:16, marginBottom:6, color:S.warm }}>Your library is empty</p>
          <p style={{ fontSize:13, color:"#B8B0A4", marginBottom:24 }}>
            Fund an article to unlock it and add it to your collection.
          </p>
          <button onClick={() => onNavigate("browse")} style={{
            padding:"10px 22px", background:S.ink, color:S.cream,
            border:"none", borderRadius:40, cursor:"pointer",
            fontSize:13, fontFamily:"'DM Sans', sans-serif",
          }}>Browse articles</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))", gap:16 }}>
          {articles.map((article, i) => (
            <article key={article.id} className="card hover-lift"
              onClick={() => onNavigate("article", article.id)}
              style={{ background:"white", border:`1px solid ${S.rule}`,
                borderRadius:16, padding:"24px 28px", cursor:"pointer",
                animationDelay:`${i * 0.06}s` }}>
              <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                {article.credit_tier && (
                  <Pill
                    bg={article.credit_tier === "Executive Associate Producer" ? S.goldBg : "#F0EBF8"}
                    fg={article.credit_tier === "Executive Associate Producer" ? "#8B5A10" : "#5B3A9A"}
                    bd={article.credit_tier === "Executive Associate Producer" ? S.goldBd : "#C8B0E8"}
                  >{article.credit_tier}</Pill>
                )}
              </div>
              <h3 style={{ fontFamily:"'Playfair Display', serif", fontSize:17,
                fontWeight:700, color:S.ink, lineHeight:1.35, marginBottom:8 }}>
                {article.title}
              </h3>
              <p style={{ color:S.warm, fontSize:13, lineHeight:1.55, marginBottom:12,
                display:"-webkit-box", WebkitLineClamp:2,
                WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                {article.excerpt}
              </p>
              <p style={{ fontSize:12, color:"#B8B0A4",
                fontFamily:"'Playfair Display', serif", fontStyle:"italic" }}>
                {article.author_name} · {formatMicro(article.user_total_micro)} contributed
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

// ── Publish view ──────────────────────────────────────────────────────────────
function PublishView({ onPublished }) {
  const [title,   setTitle]   = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [tags,    setTags]    = useState("");
  const [goalDollars, setGoalDollars] = useState("");
  const [isFree,  setIsFree]  = useState(false);
  const [errors,  setErrors]  = useState({});
  const [busy,    setBusy]    = useState(false);

  const validate = () => {
    const e = {};
    if (!title.trim())   e.title   = "Required";
    if (!content.trim()) e.content = "Required";
    if (!isFree && !goalDollars) e.goal = "Set a goal or mark as free";
    return e;
  };

  const handlePublish = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const data = await publishArticle({
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        content: content.trim(),
        tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        funding_goal_dollars: isFree ? 0 : parseFloat(goalDollars),
      });
      onPublished(data.article.id);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setBusy(false);
    }
  };

  const label = (text) => (
    <label style={{ display:"block", fontSize:11, fontWeight:600, color:S.warm,
      marginBottom:8, letterSpacing:"0.04em", textTransform:"uppercase",
      fontFamily:"'DM Sans', sans-serif" }}>{text}</label>
  );

  const inputStyle = (field) => ({
    width:"100%", padding:"11px 14px",
    border:`1px solid ${errors[field] ? S.red : S.rule}`,
    borderRadius:10, fontSize:14, color:S.ink,
    background:"white", fontFamily:"'DM Sans', sans-serif",
    transition:"border-color 0.15s, box-shadow 0.15s",
  });

  return (
    <main style={{ maxWidth:660, margin:"0 auto", padding:"48px 24px 80px" }}>
      <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:36,
        fontWeight:700, color:S.ink, marginBottom:32, letterSpacing:"-0.02em" }}>
        Publish an Article
      </h1>

      <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
        <div>
          {label("Title")}
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Your article title"
            style={{ ...inputStyle("title"), fontSize:16, fontFamily:"'Playfair Display', serif" }} />
          {errors.title && <p style={{ color:S.red, fontSize:11, marginTop:4 }}>{errors.title}</p>}
        </div>

        <div>
          {label("Excerpt (optional)")}
          <textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A one-sentence description"
            style={{ ...inputStyle("excerpt"), resize:"vertical", lineHeight:1.6 }} />
        </div>

        <div>
          {label("Content")}
          <textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)}
            placeholder={"Write your article here.\n\nSeparate paragraphs with a blank line."}
            style={{ ...inputStyle("content"), resize:"vertical", lineHeight:1.75, fontWeight:300 }} />
          {errors.content && <p style={{ color:S.red, fontSize:11, marginTop:4 }}>{errors.content}</p>}
        </div>

        <div>
          {label("Tags (comma-separated)")}
          <input value={tags} onChange={(e) => setTags(e.target.value)}
            placeholder="technology, culture, science"
            style={inputStyle("tags")} />
        </div>

        <div style={{ background:S.goldBg, border:`1px solid ${S.goldBd}`,
          borderRadius:14, padding:"22px 24px" }}>
          <h3 style={{ fontFamily:"'Playfair Display', serif", fontSize:18,
            color:S.ink, marginBottom:16 }}>Monetization</h3>

          <label style={{ display:"flex", alignItems:"center", gap:10,
            cursor:"pointer", marginBottom:16, userSelect:"none" }}>
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)}
              style={{ width:16, height:16, accentColor:S.gold }} />
            <span style={{ fontSize:14, color:S.ink }}>Publish as free — no funding goal</span>
          </label>

          {!isFree && (
            <div>
              {label("Funding Goal (USD)")}
              <p style={{ fontSize:12, color:S.warm, marginBottom:10, lineHeight:1.5 }}>
                Readers pay to unlock access. Once the goal is reached, the article becomes
                free for everyone. Contributors earn producer credits.
              </p>
              <input type="number" min="1" step="1" value={goalDollars}
                onChange={(e) => setGoalDollars(e.target.value)}
                placeholder="e.g. 50"
                style={{ ...inputStyle("goal"), maxWidth:180 }} />
              {errors.goal && <p style={{ color:S.red, fontSize:11, marginTop:4 }}>{errors.goal}</p>}
            </div>
          )}
        </div>

        {errors.submit && <p style={{ color:S.red, fontSize:13 }}>{errors.submit}</p>}

        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <button onClick={handlePublish} disabled={busy} style={{
            padding:"12px 28px", background:busy ? "#555" : S.ink,
            color:S.cream, border:"none", borderRadius:40,
            cursor:busy ? "default" : "pointer", fontSize:14,
            fontWeight:600, fontFamily:"'DM Sans', sans-serif",
          }}>
            {busy ? "Publishing…" : "Publish Article"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Loading / Error states ────────────────────────────────────────────────────
const LoadingState = () => (
  <div style={{ textAlign:"center", padding:"96px 0", color:S.warm, fontSize:14 }}>
    Loading…
  </div>
);

const ErrorState = ({ message }) => (
  <div style={{ textAlign:"center", padding:"96px 0", color:S.red, fontSize:14 }}>
    {message}
  </div>
);

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, login, register, logout } = useAuth();
  const [view,        setView]        = useState("browse");
  const [articleId,   setArticleId]   = useState(null);
  const [showAuth,    setShowAuth]    = useState(false);
  const [notification, setNotification] = useState(null);

  const navigate = (target, id = null) => {
    setView(target);
    if (id) setArticleId(id);
  };

  const notify = (msg) => setNotification(msg);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:S.cream, display:"flex",
      alignItems:"center", justifyContent:"center", color:S.warm, fontSize:14 }}>
      <style>{FONT}</style>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:S.cream }}>
      <style>{FONT}</style>

      <Header
        user={user} view={view}
        onNavigate={navigate}
        onShowAuth={() => setShowAuth(true)}
        onLogout={logout}
      />

      {view === "browse" && (
        <BrowseView user={user} onNavigate={navigate} onShowAuth={() => setShowAuth(true)} />
      )}

      {view === "article" && articleId && (
        <ArticleView
          articleId={articleId} user={user}
          onNavigate={navigate}
          onShowAuth={() => setShowAuth(true)}
          onNotify={notify}
        />
      )}

      {view === "library" && user && (
        <LibraryView user={user} onNavigate={navigate} />
      )}

      {view === "publish" && user && (
        <PublishView onPublished={(id) => navigate("article", id)} />
      )}

      {showAuth && (
        <AuthModal
          onLogin={async (creds) => { await login(creds); setShowAuth(false); }}
          onRegister={async (details) => { await register(details); setShowAuth(false); }}
        />
      )}

      {notification && (
        <Toast message={notification} onDismiss={() => setNotification(null)} />
      )}
    </div>
  );
}
