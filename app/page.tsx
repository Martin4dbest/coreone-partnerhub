import LivePartnerStats from "@/app/components/LivePartnerStats";
import PublicResources from "@/app/components/PublicResources";
import HeroLiveOverview from "@/app/components/HeroLiveOverview";
import Link from "next/link";
import Image from "next/image";

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SchoolIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m3 9 9-5 9 5-9 5-9-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M6 11v5c3.8 3 8.2 3 12 0v-5M21 9v7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M16 5a3.5 3.5 0 0 1 0 6.8M18 14a5 5 0 0 1 3.5 4.8V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const WalletIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 10h18M16 15h.01M7 6V4.5A1.5 1.5 0 0 1 8.5 3H18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 3v18h18M7 14l4-4 4 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Home() {
  return (
    <main>
      <div className="announcement">
        <span className="announcement-dot" />
        Connecting schools with opportunities through CoreOne.
        <a href="#how-it-works">Discover the opportunity <span>↗</span></a>
      </div>

      <header className="site-header">
        <div className="container nav-wrap">
          <Link href="/" className="brand" aria-label="CoreOne PartnerHub home">
            <Image
              src="/images/core-one-logo.jpeg"
              alt="CoreOne logo"
              width={110}
              height={60}
              className="brand-logo"
              priority
            />
            <span className="brand-copy">
              <strong>CoreOne</strong>
              <small>PARTNERHUB</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Main navigation">
            <a href="#about">About</a>
            <a href="#benefits">Why partner with us</a>
            <a href="#how-it-works">How it works</a>
          </nav>

          <div className="nav-actions">
            <Link href="/login" className="login-link">Sign in</Link>
            <Link href="/register" className="button button-dark button-small">
              Become a partner <Arrow />
            </Link>
          </div>
        </div>
      </header>

      <section className="hero" id="about">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="eyebrow"><span /> THE COREONE PARTNER NETWORK</div>
            <div className="floating-card floating-card-top">
              <span className="float-icon float-green"><SchoolIcon /></span>
              <span><small>School partnerships</small><strong>Built on trust</strong></span>
            </div>
            <h1>
              Turn your connections into <span className="gold-text">opportunity.</span>
            </h1>
            <p className="hero-description">
              Help schools discover smarter ways to manage education with CoreOne.
              Build valuable partnerships, grow your network, and earn commissions
              for eligible schools you bring on board.
            </p>

            <div className="hero-actions">
              <Link href="/register" className="button button-gold">
                Partner <Arrow />
              </Link>
              <a href="#how-it-works" className="button button-outline">
                See how it works <span className="play-icon">↘</span>
              </a>
            </div>

            <div className="hero-assurance">
              <span className="assurance-icon"><Check /></span>
              <span>Open applications <i /> Transparent process <i /> Performance tracking</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Illustration of the CoreOne partner dashboard">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-panel">
              <div className="panel-top">
                <div>
                  <span className="panel-kicker">PARTNER OVERVIEW</span>
                  <h3>Your partner overview</h3>
                </div>
                <span className="panel-menu">•••</span>
              </div>

              <HeroLiveOverview />

              <div className="panel-bottom">
                <div className="mini-avatars"><i>C</i><i>+</i><i>+</i></div>
                <span>Live network figures refresh automatically from recorded database activity.</span>
              </div>
            </div>

            <div className="floating-card floating-card-bottom">
              <span className="float-icon float-gold"><WalletIcon /></span>
              <span><small>Commission tracking</small><strong>Clear and transparent</strong></span>
            </div>
            <div className="visual-spark spark-one">✳</div>
            <div className="visual-spark spark-two">✦</div>
          </div>
        </div>
        <div className="hero-bottom container">
          <span>ONE NETWORK. MORE POSSIBILITIES.</span>
          <span className="hero-bottom-line" />
          <span>MADE FOR PEOPLE WHO MOVE EDUCATION FORWARD</span>
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-inner">
          <div className="trust-label">YOUR ROLE IN THE NETWORK</div>
          <div className="trust-item"><span className="trust-symbol"><PeopleIcon /></span><span>Build relationships</span></div>
          <div className="trust-item"><span className="trust-symbol"><SchoolIcon /></span><span>Connect schools</span></div>
          <div className="trust-item"><span className="trust-symbol"><ChartIcon /></span><span>Track your progress</span></div>
          <div className="trust-item"><span className="trust-symbol"><WalletIcon /></span><span>Earn eligible commissions</span></div>
        </div>
      </section>

      <LivePartnerStats />
      <PublicResources />

      <section className="section benefits-section" id="benefits">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow eyebrow-light">WHY COREONE PARTNERHUB</span>
            <h2>A partnership built around <span>your growth.</span></h2>
            <p>Bring your network, your ambition, and your understanding of your community. We provide a structured way to turn school connections into measurable progress.</p>
          </div>

          <div className="benefit-grid">
            <article className="benefit-card">
              <div className="benefit-icon icon-navy"><PeopleIcon /></div>
              <span className="card-number">01 / NETWORK</span>
              <h3>Build meaningful connections</h3>
              <p>Introduce schools to CoreOne and help decision-makers discover tools designed to support their operations.</p>
              <a href="#how-it-works">Explore the process <Arrow /></a>
            </article>
            <article className="benefit-card benefit-card-featured">
              <div className="benefit-icon icon-gold"><WalletIcon /></div>
              <span className="card-number">02 / EARNINGS</span>
              <h3>Understand your commissions</h3>
              <p>See eligible earnings, pending amounts, and recorded payments in one place, subject to the agreed commission rules.</p>
              <a href="#how-it-works">How commissions work <Arrow /></a>
            </article>
            <article className="benefit-card">
              <div className="benefit-icon icon-green"><ChartIcon /></div>
              <span className="card-number">03 / PERFORMANCE</span>
              <h3>Measure your progress</h3>
              <p>Track the schools you introduce, follow their onboarding status, and understand how your network is growing.</p>
              <a href="#how-it-works">See the steps <Arrow /></a>
            </article>
          </div>
        </div>
      </section>

      <section className="section process-section" id="how-it-works">
        <div className="container process-grid">
          <div className="process-intro">
            <span className="eyebrow eyebrow-light">A CLEAR PATH FORWARD</span>
            <h2>From application to <span>school partnership.</span></h2>
            <p>Our process is designed to be clear at every stage, from your first application to tracking the schools you successfully bring on board.</p>
            <Link href="/register" className="button button-dark">
              Start your application <Arrow />
            </Link>
            <div className="process-note"><ShieldIcon /><span>Your application is reviewed before representative access is approved.</span></div>
          </div>

          <div className="process-list">
            <article className="process-step">
              <span className="step-number">01</span>
              <div className="step-content">
                <span className="step-tag">GET STARTED</span>
                <h3>Create your account</h3>
                <p>Register your details. Check back after a few minutes or hours to see if you have been approved. Once approved, log in to access the platform’s features. </p>
              </div>
              <span className="step-check"><Check /></span>
            </article>
            
            <article className="process-step">
              <span className="step-number">02</span>
              <div className="step-content">
                <span className="step-tag">BUILD YOUR NETWORK</span>
                <h3>Introduce schools to CoreOne</h3>
                <p>Once approved, register prospective schools and monitor each school's onboarding progress.</p>
              </div>
              <span className="step-check"><Check /></span>
            </article>
            <article className="process-step">
              <span className="step-number">03</span>
              <div className="step-content">
                <span className="step-tag">TRACK YOUR EARNINGS</span>
                <h3>Follow eligible commissions</h3>
                <p>Review commission records and payment status in line with CoreOne's approved commission policy.</p>
              </div>
              <span className="step-check"><Check /></span>
            </article>
          </div>
        </div>
      </section>

      <section className="section principles-section">
        <div className="container principles-grid">
          <div>
            <span className="eyebrow eyebrow-light">BUILT ON TRUST</span>
            <h2>Clear records.<br /><span>Confident partnerships.</span></h2>
          </div>
          <div className="principle">
            <span><ShieldIcon /></span>
            <div><h3>Reviewed applications</h3><p>Representative access follows an administrator review and approval process.</p></div>
          </div>
          <div className="principle">
            <span><SchoolIcon /></span>
            <div><h3>Accountable school records</h3><p>Track school submissions and their status through a structured workflow.</p></div>
          </div>
          <div className="principle">
            <span><WalletIcon /></span>
            <div><h3>Transparent commission records</h3><p>Keep eligible earnings, adjustments, and payment history clearly recorded.</p></div>
          </div>
        </div>
      </section>

      <section className="join-section" id="join">
        <div className="container join-card">
          <div className="join-decoration join-decoration-one" />
          <div className="join-decoration join-decoration-two" />
          <div className="join-copy">
            <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2>Ready to grow with <span>CoreOne?</span></h2>
            <p>Join the CoreOne partner network and help schools discover a smarter way to manage education.</p>
          </div>
          <div className="join-actions">
            <Link href="/register" className="button button-gold">
              Apply to become a partner <Arrow />
            </Link>
            <span>Applications are subject to review and approval.</span>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand-block">
            <Link href="/" className="brand brand-footer">
              <Image
                src="/images/core-one-logo.jpeg"
                alt="CoreOne logo"
                width={100}
                height={55}
                className="brand-logo"
              />
              <span className="brand-copy"><strong>CoreOne</strong><small>PARTNERHUB</small></span>
            </Link>
            <p>A platform for managing school referrals, partner applications, and eligible commission records.</p>
          </div>
          <div className="footer-links">
            <strong>Explore</strong>
            <a href="#about">About the platform</a>
            <a href="#benefits">Partner benefits</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <div className="footer-links">
            <strong>Partner access</strong>
            <Link href="/register">Become a Partner</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 CoreOne PartnerHub. All rights reserved.</span>
          <span>Built for better school partnerships.</span>
        </div>
      </footer>
    </main>
  );
}
