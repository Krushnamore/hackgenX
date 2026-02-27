import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, MapPin, Trophy, FileText, Search, CheckCircle, Star, ArrowRight } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Landing() {
  const { t } = useTranslation();

  const stats = [
    { value: '12,000+', label: t('landing.stats.issuesResolved') },
    { value: '98%', label: t('landing.stats.responseRate') },
    { value: '340', label: t('landing.stats.wardsCovered') },
    { value: '4.8★', label: t('landing.stats.citizenRating') },
  ];

  const steps = [
    { icon: FileText, title: t('landing.steps.reportTitle'), desc: t('landing.steps.reportDesc') },
    { icon: Search, title: t('landing.steps.reviewTitle'), desc: t('landing.steps.reviewDesc') },
    { icon: CheckCircle, title: t('landing.steps.resolveTitle'), desc: t('landing.steps.resolveDesc') },
    { icon: Star, title: t('landing.steps.rewardTitle'), desc: t('landing.steps.rewardDesc') },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-heading font-bold text-primary">जनवाणी</span>
            <span className="text-xs font-heading text-muted-foreground tracking-widest">JANVANI</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-body text-muted-foreground">
            <a href="#about" className="hover:text-foreground transition-colors">{t('nav.about')}</a>
            <a href="#how" className="hover:text-foreground transition-colors">{t('nav.howItWorks')}</a>
            <a href="#portals" className="hover:text-foreground transition-colors">{t('nav.portals')}</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <Button variant="hero" size="sm" asChild><Link to="/citizen/login">{t('landing.citizenLogin')}</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/login">{t('landing.adminPortal')}</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="absolute inset-0 bg-primary/70" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-heading font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-in">
            {t('landing.heroTitleLine1')}<br />{t('landing.heroTitleLine2')}
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10 font-body" style={{ animationDelay: '0.1s' }}>
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Button variant="sky" size="lg" asChild><Link to="/citizen/report"><FileText className="h-5 w-5 mr-2" />{t('landing.reportProblem')}</Link></Button>
            <Button variant="hero-outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/citizen/track"><Search className="h-5 w-5 mr-2" />{t('landing.trackComplaint')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="about" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold text-center mb-12">{t('landing.whyTitle')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: t('landing.features.aiTitle'), desc: t('landing.features.aiDesc') },
              { icon: MapPin, title: t('landing.features.trackTitle'), desc: t('landing.features.trackDesc') },
              { icon: Trophy, title: t('landing.features.rewardsTitle'), desc: t('landing.features.rewardsDesc') },
            ].map((f, i) => (
              <div key={i} className="card-elevated p-6 text-center group">
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                  <f.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground font-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold text-center mb-12">{t('landing.howTitle')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <div className="h-16 w-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold shadow-lg shadow-accent/20">{i + 1}</div>
                <h3 className="font-heading font-semibold mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-primary">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-heading font-extrabold text-primary-foreground">{s.value}</div>
              <div className="text-sm text-primary-foreground/70 font-body">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Portal Choice */}
      <section id="portals" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold text-center mb-12">{t('landing.choosePortalTitle')}</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <Link to="/citizen/login" className="card-elevated p-8 text-center border-l-4 border-l-accent group">
              <div className="text-5xl mb-4">🏠</div>
              <h3 className="text-xl font-heading font-bold mb-2">{t('landing.citizenPortalTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('landing.citizenPortalDesc')}</p>
              <span className="text-accent font-semibold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">{t('landing.enterPortal')} <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link to="/admin/login" className="card-elevated p-8 text-center border-l-4 border-l-warning group">
              <div className="text-5xl mb-4">🏛️</div>
              <h3 className="text-xl font-heading font-bold mb-2">{t('landing.adminPortalTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('landing.adminPortalDesc')}</p>
              <span className="text-warning font-semibold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">{t('landing.enterPortal')} <ArrowRight className="h-4 w-4" /></span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-10">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl font-heading font-bold text-primary-foreground">जनवाणी</span>
            <span className="text-xs text-primary-foreground/50">JANVANI</span>
          </div>
          <p className="text-sm text-primary-foreground/60 font-body">{t('landing.footerTagline')}</p>
          <p className="text-xs text-primary-foreground/40 mt-4">{t('landing.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
