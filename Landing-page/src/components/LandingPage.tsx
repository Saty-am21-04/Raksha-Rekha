import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Menu,
  X,
  Activity,
  History,
  Eye,
  FileText,
  AlertTriangle,
  MapPin,
  Shield,
  BarChart3,
  Play,
  Github,
  Database,
  Layers,
  Globe,
  Server,
  Check,
  ArrowRight,
} from "lucide-react";

import heroBg from "@/assets/raksha-hero-bg.jpg";
import dashboardImg from "@/assets/raksha-dashboard.jpg";
import explainabilityImg from "@/assets/raksha-explainability.jpg";
import architectureImg from "@/assets/raksha-architecture.jpg";
import logoAsset from "@/assets/logo.png.asset.json";

const BAR_HEIGHTS = [
  23, 40, 53, 40, 33, 14, 7, 17, 75, 65,
  88, 75, 65, 47, 33, 88, 4, 7, 9, 14,
  95, 65, 79, 37, 7, 40, 17, 20, 62, 47,
  92, 72,
];

function Animate({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "scale";
}) {
  const directions = {
    up: "animate-fade-up",
    down: "animate-fade-down",
    left: "animate-fade-left",
    right: "animate-fade-right",
    scale: "animate-fade-scale",
  } as const;

  return (
    <div
      className={`opacity-0 ${directions[direction]} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.15, ...options });
    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
}

function ScrollAnimate({
  children,
  className = "",
  direction = "up",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "scale";
  delay?: number;
}) {
  const { ref, isInView } = useInView<HTMLDivElement>();
  const directions = {
    up: "animate-fade-up",
    down: "animate-fade-down",
    left: "animate-fade-left",
    right: "animate-fade-right",
    scale: "animate-fade-scale",
  } as const;

  return (
    <div
      ref={ref}
      className={`${isInView ? directions[direction] : "opacity-0"} ${className}`}
      style={{ animationDelay: `${delay}ms"` }}
    >
      {children}
    </div>
  );
}

function RiskScoreCard() {
  const maxHeight = Math.max(...BAR_HEIGHTS);

  return (
    <Animate delay={900} direction="scale" className="w-full max-w-[405px] mx-auto lg:mx-0">
      <div className="w-full rounded-[24px] sm:rounded-[33px] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-5 sm:p-8 pb-5 sm:pb-6 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <p className="text-white text-[16px] sm:text-[20px] font-[450] leading-[20px]">
            Live Risk Score
          </p>
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] sm:text-[12px] font-[450]">
            Wayanad, Kerala
          </span>
        </div>
        <p className="mb-2 sm:mb-3">
          <span className="text-white text-[28px] sm:text-[46px] font-[450] leading-[1]">
            87.4
          </span>
          <span className="text-white/20 text-[28px] sm:text-[46px] font-[450] leading-[1]">
            /100
          </span>
        </p>
        <div className="flex items-center gap-[10px] mb-6 sm:mb-8">
          <span className="px-[6px] py-[7px] bg-red-500/20 text-red-300 rounded-[6px] text-[12px] sm:text-[14px] font-[450] leading-[14px]">
            High Risk
          </span>
          <span className="text-white/80 text-[12px] sm:text-[14px] font-[450] leading-[14px] opacity-70">
            12 habitations flagged
          </span>
        </div>

        <div className="relative">
          <div className="flex items-end gap-[1.5px] h-[80px] sm:h-[100px]">
            {BAR_HEIGHTS.map((h, i) => {
              const isProjected = i >= 28;
              const heightPercent = (h / maxHeight) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-[0.5px] animate-bar-grow origin-bottom"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: isProjected ? "rgba(255,255,255,0.1)" : "rgba(245,158,11,0.9)",
                    animationDelay: `${1100 + i * 30}ms`,
                  }}
                />
              );
            })}
          </div>

          <div className="absolute inset-0 pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-white/10"
                style={{ left: `${((i + 1) / 5) * 100}%` }}
              />
            ))}
          </div>

          <div className="flex justify-between mt-3">
            {["T-72h", "T-48h", "T-24h", "Now", "T+12h"].map((label, i) => (
              <span
                key={i}
                className="text-[9px] sm:text-[10px] font-[450] leading-[10px] text-white/80"
                style={{ opacity: i >= 3 ? 0.4 : 1 }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Animate>
  );
}

function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`w-full py-20 sm:py-28 md:py-36 bg-[#060B10] ${className}`}
    >
      <div className="max-w-[1800px] mx-auto px-5 sm:px-8 md:px-[82px]">
        {children}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <ScrollAnimate className="max-w-[760px] mb-12 sm:mb-16">
      <span className="inline-block text-amber-400 text-[12px] sm:text-[13px] font-[450] tracking-[0.12em] uppercase mb-4">
        {eyebrow}
      </span>
      <h2 className="text-white text-[28px] sm:text-[40px] md:text-[48px] font-normal leading-[1.05] mb-4 sm:mb-6">
        {title}
      </h2>
      {description && (
        <p className="text-white/70 text-[16px] sm:text-[18px] md:text-[20px] font-[450] leading-[1.4]">
          {description}
        </p>
      )}
    </ScrollAnimate>
  );
}

function Hero() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-[#060B10]">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260813_092641_de52eb87-daf2-41db-92cb-7a56eae012a5.mp4"
        poster={heroBg}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#060B10]/30 via-[#060B10]/45 to-[#060B10]" />

      <div className="relative z-10 h-full flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center py-16 md:py-8">
          <div className="w-full max-w-[1800px] mx-auto px-5 sm:px-8 md:px-[82px] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12 lg:gap-16">
            <div className="max-w-[640px]">
              <Animate delay={300} direction="up">
                <h1 className="text-white text-[36px] sm:text-[52px] md:text-[64px] lg:text-[72px] font-normal leading-[0.95] mb-5 sm:mb-8">
                  RAKSHA-REKHA
                </h1>
              </Animate>
              <Animate delay={450} direction="up">
                <p className="text-amber-400 text-[18px] sm:text-[22px] md:text-[26px] font-[450] leading-[1.25] mb-5 sm:mb-8">
                  “The line that decides who moves before it's too late.”
                </p>
              </Animate>
              <Animate delay={600} direction="up">
                <p className="text-white/80 text-[16px] sm:text-[18px] md:text-[20px] font-[450] leading-[1.3] max-w-[520px] mb-7 sm:mb-10">
                  AI-driven GIS platform for disaster relocation planning in India.
                </p>
              </Animate>
              <Animate delay={750} direction="up">
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 h-[46px] sm:h-[51px] px-5 sm:px-[27px] bg-[#E9E9E9] rounded-[12px] text-[#0A0707] text-[14px] sm:text-[15.5px] font-[450] leading-[15.5px] transition-opacity hover:opacity-90"
                  >
                    <Play className="w-4 h-4" />
                    Watch Demo
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 h-[46px] sm:h-[51px] px-5 sm:px-[27px] rounded-[12px] border border-white text-white text-[14px] sm:text-[15.5px] font-[450] leading-[15.5px] transition-opacity hover:opacity-80"
                  >
                    <Github className="w-4 h-4" />
                    View on GitHub
                  </a>
                </div>
              </Animate>
            </div>
            <RiskScoreCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <Section id="problem">
      <SectionHeading
        eyebrow="The Problem"
        title="Disaster relocation in India is reactive, not predictive"
        description="When landslides or floods strike, decisions are made under pressure — often without a live view of who is most at risk or whether safe sites can actually absorb evacuees."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[
          {
            value: "~75%",
            label: "of Indian districts are multi-hazard prone",
            source: "NIDM / MHA estimates",
          },
          {
            value: "1,000+",
            label: "lives lost annually to landslides & floods",
            source: "IMD / EM-DAT trends",
          },
          {
            value: "Hours",
            label: "not days, to decide who moves first",
            source: "Field response reality",
          },
        ].map((stat, i) => (
          <ScrollAnimate key={stat.label} delay={i * 100} direction="up">
            <div className="rounded-[24px] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] border border-white/[0.06] p-6 sm:p-8 h-full">
              <p className="text-amber-400 text-[36px] sm:text-[48px] font-normal leading-[1] mb-3">
                {stat.value}
              </p>
              <p className="text-white text-[16px] sm:text-[18px] font-[450] leading-[1.3] mb-2">
                {stat.label}
              </p>
              <p className="text-white/50 text-[13px] font-[450]">{stat.source}</p>
            </div>
          </ScrollAnimate>
        ))}
      </div>
    </Section>
  );
}

function SolutionSection() {
  const features = [
    {
      icon: Activity,
      title: "Live Scoring",
      text: "Habitations are scored in real time from hazard, exposure, and vulnerability data.",
    },
    {
      icon: History,
      title: "Backtest-Proven",
      text: "Models are validated against historical disasters before they ever guide a live decision.",
    },
    {
      icon: Eye,
      title: "Explainable",
      text: "Every risk rank comes with clear drivers, not a black-box number.",
    },
    {
      icon: FileText,
      title: "Actionable Reports",
      text: "One-click relocation reports for district control rooms and response teams.",
    },
  ];

  return (
    <Section id="solution" className="bg-[#0A1119]">
      <SectionHeading
        eyebrow="The Solution"
        title="Maps Red Zones. Scores risk. Ranks relocation priority."
        description="RAKSHA-REKHA turns scattered hazard and census data into a single, prioritized line of action — so responders know who to move, where, and when capacity still exists."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {features.map((f, i) => (
          <ScrollAnimate key={f.title} delay={i * 100} direction="up">
            <div className="rounded-[24px] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] border border-white/[0.06] p-6 sm:p-8 h-full group transition-colors hover:bg-[rgba(255,255,255,0.03)]">
              <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-amber-500/15 to-teal-500/10 flex items-center justify-center mb-5 text-amber-400 group-hover:text-amber-300 transition-colors">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-white text-[18px] sm:text-[20px] font-[450] mb-2">
                {f.title}
              </h3>
              <p className="text-white/60 text-[14px] sm:text-[15px] font-[450] leading-[1.5]">
                {f.text}
              </p>
            </div>
          </ScrollAnimate>
        ))}
      </div>
    </Section>
  );
}

function BacktestSection() {
  return (
    <Section id="backtest" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 via-transparent to-teal-500/10 pointer-events-none" />
      <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <ScrollAnimate>
            <span className="inline-block text-amber-400 text-[12px] sm:text-[13px] font-[450] tracking-[0.12em] uppercase mb-4">
              Backtest Mode
            </span>
            <h2 className="text-white text-[28px] sm:text-[40px] md:text-[48px] font-normal leading-[1.05] mb-5 sm:mb-6">
              Tested against real history
            </h2>
            <p className="text-white/80 text-[16px] sm:text-[18px] md:text-[20px] font-[450] leading-[1.4] mb-6">
              Our model flags the 2024 Wayanad landslide conditions as high-risk
              <span className="text-amber-400"> before the fact</span>. Backtest Mode lets
              planners replay past events and build trust before the next monsoon.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Replay any historical date",
                "Compare model warnings with actual outcomes",
                "Tune thresholds for local terrain and response capacity",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/70 text-[15px] font-[450]">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <ScrollAnimate delay={200} direction="up">
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[14px] font-[450]">
                <History className="w-4 h-4" />
                Wayanad 2024 — flagged 48 hours ahead
              </div>
            </ScrollAnimate>
          </ScrollAnimate>
        </div>
        <ScrollAnimate direction="scale" delay={200}>
          <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-3 sm:p-4">
            <img
              src={dashboardImg}
              alt="RAKSHA-REKHA dashboard showing risk-scored habitations and Red Zones"
              className="w-full rounded-[20px]"
              loading="lazy"
              width={1440}
              height={900}
            />
          </div>
        </ScrollAnimate>
      </div>
    </Section>
  );
}

function HowItWorksSection() {
  return (
    <Section id="how-it-works" className="bg-[#0A1119]">
      <SectionHeading
        eyebrow="How It Works"
        title="From raw data to relocation-ready reports"
      />
      <ScrollAnimate direction="scale">
        <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-3 sm:p-5 mb-10 sm:mb-14">
          <img
            src={architectureImg}
            alt="RAKSHA-REKHA architecture: data sources to scoring engine to dashboard to reports"
            className="w-full rounded-[20px]"
            loading="lazy"
            width={1440}
            height={600}
          />
        </div>
      </ScrollAnimate>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          {
            icon: Database,
            title: "Data Sources",
            text: "Satellite, weather, terrain, census, and live hazard feeds.",
          },
          {
            icon: BarChart3,
            title: "Scoring Engine",
            text: "Risk + safe-site capacity combined into a single priority rank.",
          },
          {
            icon: Globe,
            title: "GIS Dashboard",
            text: "Interactive Red Zones, habitations, and capacity maps.",
          },
          {
            icon: FileText,
            title: "Reports",
            text: "Downloadable relocation lists for control rooms.",
          },
        ].map((step, i) => (
          <ScrollAnimate key={step.title} delay={i * 100} direction="up">
            <div className="relative rounded-[24px] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] border border-white/[0.06] p-6 sm:p-8 h-full">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-5 text-amber-400">
                <step.icon className="w-4 h-4" />
              </div>
              <h3 className="text-white text-[18px] font-[450] mb-2">{step.title}</h3>
              <p className="text-white/60 text-[14px] sm:text-[15px] font-[450] leading-[1.5]">
                {step.text}
              </p>
            </div>
          </ScrollAnimate>
        ))}
      </div>
    </Section>
  );
}

function DemoSection() {
  return (
    <Section id="demo">
      <SectionHeading
        eyebrow="Live Demo"
        title="See the platform in action"
        description="Explore the dashboard, explainability panel, and the backtest replay that validates every warning."
      />
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-10 sm:mb-14">
        <ScrollAnimate direction="scale">
          <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-3 sm:p-4">
            <img
              src={dashboardImg}
              alt="RAKSHA-REKHA dashboard map view"
              className="w-full rounded-[20px]"
              loading="lazy"
              width={1440}
              height={900}
            />
            <p className="text-white/60 text-[13px] font-[450] mt-3 sm:mt-4 px-1">
              Dashboard map view — Red Zones and safe-site capacity
            </p>
          </div>
        </ScrollAnimate>
        <ScrollAnimate direction="scale" delay={150}>
          <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-3 sm:p-4">
            <img
              src={explainabilityImg}
              alt="RAKSHA-REKHA explainability panel showing risk drivers"
              className="w-full rounded-[20px]"
              loading="lazy"
              width={1200}
              height={800}
            />
            <p className="text-white/60 text-[13px] font-[450] mt-3 sm:mt-4 px-1">
              Explainability panel — why a habitation was ranked high
            </p>
          </div>
        </ScrollAnimate>
      </div>
      <ScrollAnimate direction="up">
        <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-3 sm:p-4">
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noreferrer"
            className="group relative w-full aspect-video rounded-[20px] overflow-hidden bg-[#0A1119] flex items-center justify-center block"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-emerald-500/10" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 backdrop-blur-[12px] border border-white/20 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white" />
              </div>
              <span className="text-white/80 text-[14px] sm:text-[16px] font-[450]">
                Watch the full demo on YouTube
              </span>
            </div>
          </a>
          <p className="text-white/60 text-[13px] font-[450] mt-3 sm:mt-4 px-1">
            Walkthrough demo — from data ingest to relocation report
          </p>
        </div>
      </ScrollAnimate>
    </Section>
  );
}

function TechStackSection() {
  const stack = [
    { name: "Supabase", icon: Database },
    { name: "PostGIS", icon: MapPin },
    { name: "Next.js", icon: Layers },
    { name: "Mapbox", icon: Globe },
  ];

  return (
    <Section id="tech-stack" className="bg-[#0A1119]">
      <ScrollAnimate className="text-center max-w-[720px] mx-auto mb-12 sm:mb-16">
        <span className="inline-block text-amber-400 text-[12px] sm:text-[13px] font-[450] tracking-[0.12em] uppercase mb-4">
          Tech Stack
        </span>
        <h2 className="text-white text-[28px] sm:text-[40px] md:text-[48px] font-normal leading-[1.05] mb-4 sm:mb-6">
          Built on proven, open tools
        </h2>
        <p className="text-white/70 text-[16px] sm:text-[18px] font-[450] leading-[1.4]">
          The same modern stack that powers scalable geospatial and AI products.
        </p>
      </ScrollAnimate>
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
        {stack.map((tech, i) => (
          <ScrollAnimate key={tech.name} delay={i * 80} direction="scale">
            <div className="flex items-center gap-3 px-6 py-4 rounded-[16px] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] border border-white/[0.06] text-white hover:border-amber-500/30 transition-colors">
              <tech.icon className="w-5 h-5 text-amber-400" />
              <span className="text-[15px] sm:text-[17px] font-[450]">{tech.name}</span>
            </div>
          </ScrollAnimate>
        ))}
      </div>
    </Section>
  );
}

function DifferentiationSection() {
  const rows = [
    { existing: "Reactive alerts after disaster strikes", raksha: "Predictive risk scoring days ahead" },
    { existing: "Static hazard maps", raksha: "Live Red Zones with habitation-level scoring" },
    { existing: "Safe-site lists without capacity checks", raksha: "Capacity-aware relocation ranking" },
    { existing: "Black-box warnings", raksha: "Explainable risk drivers per habitation" },
    { existing: "Generic dashboards", raksha: "Reports tailored for Indian control rooms" },
  ];

  return (
    <Section id="differentiation">
      <SectionHeading
        eyebrow="Why RAKSHA-REKHA"
        title="Not just another hazard map"
      />
      <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px]">
        <div className="hidden sm:grid grid-cols-2 bg-white/5 px-6 sm:px-8 py-4">
          <span className="text-white/50 text-[13px] font-[450] uppercase tracking-wider">
            Existing approaches
          </span>
          <span className="text-amber-400 text-[13px] font-[450] uppercase tracking-wider">
            RAKSHA-REKHA
          </span>
        </div>
        {rows.map((row, i) => (
          <ScrollAnimate key={i} delay={i * 80} direction="up">
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-0 px-6 sm:px-8 py-5 border-t border-white/[0.06]">
              <div className="flex items-start gap-3 text-white/50 text-[15px] sm:text-[16px] font-[450]">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {row.existing}
              </div>
              <div className="flex items-start gap-3 text-white text-[15px] sm:text-[16px] font-[450] sm:pl-8">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                {row.raksha}
              </div>
            </div>
          </ScrollAnimate>
        ))}
      </div>
    </Section>
  );
}

function SIHSection() {
  return (
    <Section id="sih-2026" className="bg-[#0A1119]">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <ScrollAnimate>
          <span className="inline-block text-amber-400 text-[12px] sm:text-[13px] font-[450] tracking-[0.12em] uppercase mb-4">
            Built for SIH 2026
          </span>
          <h2 className="text-white text-[28px] sm:text-[40px] md:text-[48px] font-normal leading-[1.05] mb-5 sm:mb-6">
            SIH26191 — Ministry of Home Affairs / NDRF
          </h2>
          <p className="text-white/80 text-[16px] sm:text-[18px] md:text-[20px] font-[450] leading-[1.4] mb-6">
            RAKSHA-REKHA is built for the Smart India Hackathon 2026 Disaster
            Management theme under the Ministry of Home Affairs and NDRF.
          </p>
          <p className="text-white/60 text-[15px] sm:text-[16px] font-[450] leading-[1.5] mb-8">
            It is a companion project to{" "}
            <span className="text-emerald-400">BHOOMI-NETRA</span>, covering the
            full disaster lifecycle: from pre-event risk assessment to post-event
            relocation and response.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-[10px] bg-white/5 border border-white/[0.08] text-white/80 text-[13px] font-[450]">
              PS Code: SIH26191
            </span>
            <span className="px-4 py-2 rounded-[10px] bg-white/5 border border-white/[0.08] text-white/80 text-[13px] font-[450]">
              Disaster Management
            </span>
            <span className="px-4 py-2 rounded-[10px] bg-white/5 border border-white/[0.08] text-white/80 text-[13px] font-[450]">
              MHA / NDRF
            </span>
          </div>
        </ScrollAnimate>
        <ScrollAnimate direction="scale" delay={200}>
          <div className="rounded-[28px] overflow-hidden border border-white/[0.08] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-8 sm:p-12 flex flex-col items-center text-center">
            <Shield className="w-16 h-16 text-amber-400 mb-6" />
            <h3 className="text-white text-[22px] sm:text-[26px] font-[450] mb-3">
              Predict. Prioritize. Protect.
            </h3>
            <p className="text-white/60 text-[15px] sm:text-[16px] font-[450] leading-[1.5]">
              The goal is simple: move the right people, to the right place,
              before the hazard becomes a tragedy.
            </p>
          </div>
        </ScrollAnimate>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="w-full bg-[#060B10] border-t border-white/[0.06]">
      <div className="max-w-[1800px] mx-auto px-5 sm:px-8 md:px-[82px] py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="RAKSHA-REKHA emblem"
              className="w-10 h-10 rounded-full"
            />
            <span className="text-white text-[22px] sm:text-[26px] font-[450] leading-none tracking-[-0.02em]">
              RAKSHA-REKHA
            </span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-white/70 text-[14px] sm:text-[15px] font-[450] hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub Repository
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
        <div className="h-px bg-white/10 my-8" />
        <p className="text-white/40 text-[13px] sm:text-[14px] font-[450]">
          © {new Date().getFullYear()} RAKSHA-REKHA. Built for SIH 2026.
        </p>
      </div>
    </footer>
  );
}

function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const navItems = [
    { label: "Problem", href: "#problem" },
    { label: "Solution", href: "#solution" },
    { label: "Backtest", href: "#backtest" },
    { label: "Demo", href: "#demo" },
    { label: "Tech", href: "#tech-stack" },
  ];

  return (
    <>
      <nav className="w-full max-w-[1800px] mx-auto px-5 sm:px-8 md:px-[82px] pt-[20px] sm:pt-[30px] flex items-center justify-between relative z-50">
        <Animate delay={0} direction="down">
          <a href="#" className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="RAKSHA-REKHA emblem"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full ring-1 ring-white/10"
            />
            <span className="text-white text-[20px] sm:text-[24px] font-[450] leading-none tracking-[-0.02em]">
              RAKSHA-REKHA
            </span>
          </a>
        </Animate>

        <Animate delay={100} direction="down" className="hidden lg:block">
          <div className="h-[52px] px-6 flex items-center gap-[30px] bg-[rgba(10,7,7,0.35)] rounded-[11px] backdrop-blur-[17px]">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-white/80 text-[14px] font-[450] leading-[14px] hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </Animate>

        <Animate delay={200} direction="down" className="hidden lg:block">
          <div className="h-[52px] p-[3px] bg-[rgba(0,0,0,0.35)] rounded-[13px] backdrop-blur-[17px] flex items-center gap-[5px]">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="h-[46px] px-6 rounded-[11px] text-white text-[14px] font-[450] leading-[14px] hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className="h-[46px] px-6 bg-[#E9E9E9] rounded-[11px] text-[#0A0707] text-[14px] font-[450] leading-[14px] hover:bg-white transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Demo
            </a>
          </div>
        </Animate>

        <Animate delay={100} direction="down" className="lg:hidden">
          <button
            className="w-[44px] h-[44px] flex items-center justify-center rounded-[11px] bg-[rgba(10,7,7,0.35)] backdrop-blur-[17px] transition-colors hover:bg-white/10"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <div className="relative w-5 h-5">
              <Menu
                className={`w-5 h-5 text-white absolute inset-0 transition-all duration-300 ease-out ${isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"}`}
              />
              <X
                className={`w-5 h-5 text-white absolute inset-0 transition-all duration-300 ease-out ${isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"}`}
              />
            </div>
          </button>
        </Animate>
      </nav>

      <div
        className={`lg:hidden fixed inset-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "visible" : "invisible"}`}
      >
        <div
          className={`absolute inset-0 bg-[#060B10]/90 backdrop-blur-[24px] transition-opacity duration-500 ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setIsOpen(false)}
        />
        <div
          className={`absolute top-[76px] sm:top-[86px] left-4 right-4 sm:left-6 sm:right-6 bg-[rgba(17,16,15,0.6)] backdrop-blur-[30px] rounded-[20px] border border-white/[0.06] p-6 sm:p-8 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] origin-top ${isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-[0.97]"}`}
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item, i) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-4 py-4 rounded-[12px] text-white/90 text-[18px] font-[450] hover:bg-white/[0.06] transition-all duration-300 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"}`}
                style={{ transitionDelay: isOpen ? `${100 + i * 50}ms` : "0ms" }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="h-px bg-white/10 my-5" />
          <div
            className={`flex flex-col gap-3 transition-all duration-300 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
            style={{ transitionDelay: isOpen ? "350ms" : "0ms" }}
          >
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className="w-full h-[50px] bg-[#E9E9E9] rounded-[12px] text-[#0A0707] text-[15px] font-[450] transition-colors hover:bg-white flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="w-full h-[50px] rounded-[12px] border border-white/30 text-white text-[15px] font-[450] transition-colors hover:bg-white/5 flex items-center justify-center gap-2"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LandingPage() {
  return (
    <main className="bg-[#060B10]">
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <BacktestSection />
      <HowItWorksSection />
      <DemoSection />
      <TechStackSection />
      <DifferentiationSection />
      <SIHSection />
      <Footer />
    </main>
  );
}
