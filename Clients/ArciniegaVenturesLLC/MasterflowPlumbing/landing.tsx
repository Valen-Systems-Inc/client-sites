// === SECTION 1: IMPORTS AND TYPES ===

interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface WhyChooseUs {
  title: string;
  description: string;
  icon: string;
}

interface ServiceArea {
  name: string;
  description: string;
}

interface Testimonial {
  name: string;
  location: string;
  text: string;
  rating: number;
}

interface FAQItem {
  question: string;
  answer: string;
}

// === SECTION 2: CONSTANTS AND CONFIGURATION ===

const WORKSPACE_BRAND_NAME = 'Masterflow Plumbing';
const WORKSPACE_FULL_NAME = 'Masterflow Plumbing & Rooter';
const WORKSPACE_TAGLINE = '24/7 Emergency Plumbing | Family-Owned';
const WORKSPACE_PRIMARY_COLOR = '#1E3A5F'; // Navy blue
const WORKSPACE_HIGHLIGHT_COLOR = '#FF6B35'; // Orange
const WORKSPACE_TYPOGRAPHY = 'Montserrat';
const WORKSPACE_PHONE = '909-272-5456';
const WORKSPACE_INSTAGRAM = '@masterflow_plumbing';
const WORKSPACE_LOCATION = 'Murrieta, California';
const WORKSPACE_SPACE_URL = '/space/{{workspace-id}}';
const WORKSPACE_HERO_VIDEO_URL = 'https://storage.googleapis.com/audos-images/videos/scene_group_1774835387564_stitched.mp4';

const SERVICES: Service[] = [
  {
    id: 'emergency',
    title: 'Emergency Plumbing (24/7)',
    description: 'Burst pipes, major leaks, or overflowing fixtures? We respond fast, day or night, to protect your home from water damage.',
    icon: ''
  },
  {
    id: 'drain',
    title: 'Drain Cleaning & Rooter',
    description: 'Stubborn clogs and slow drains cleared quickly using professional-grade equipment. We get your drains flowing again.',
    icon: ''
  },
  {
    id: 'water-heater',
    title: 'Water Heater Repair & Installation',
    description: 'No hot water? We repair and install all types of water heaters, including tankless systems, with same-day service available.',
    icon: ''
  },
  {
    id: 'leak',
    title: 'Leak Detection & Repair',
    description: 'Hidden leaks can cause major damage. Our advanced detection technology finds leaks fast so we can fix them before they spread.',
    icon: ''
  },
  {
    id: 'sewer',
    title: 'Sewer Line Services',
    description: 'From inspections to repairs and replacements, we handle all sewer line issues with minimal disruption to your property.',
    icon: ''
  },
  {
    id: 'bathroom-kitchen',
    title: 'Bathroom & Kitchen Plumbing',
    description: 'Faucet repairs, fixture installations, garbage disposals, and more. Quality workmanship for every room in your home.',
    icon: ''
  }
];

const WHY_CHOOSE_US: WhyChooseUs[] = [
  {
    title: 'Family-Owned',
    description: 'We treat your home like our own. As a family business, we take pride in honest, personalized service for every customer.',
    icon: ''
  },
  {
    title: '24/7 Availability',
    description: `Emergencies don't wait, and neither do we. Call us anytime — day or night, weekends and holidays included.`,
    icon: ''
  },
  {
    title: 'Licensed & Insured',
    description: 'Full protection and peace of mind. Our technicians are licensed professionals who stand behind their work.',
    icon: ''
  },
  {
    title: 'Upfront Pricing',
    description: `No surprises, no hidden fees. We provide clear quotes before starting any work so you know exactly what to expect.`,
    icon: ''
  },
  {
    title: 'Local Experts',
    description: `Based in ${WORKSPACE_LOCATION}, we know Southern California plumbing inside and out. Fast response times for our community.`,
    icon: ''
  },
  {
    title: 'Quality Guaranteed',
    description: 'We use quality parts and proven techniques. Our work is guaranteed because we do it right the first time.',
    icon: ''
  }
];

const SERVICE_AREAS: ServiceArea[] = [
  { name: 'Inland Empire', description: 'Riverside, San Bernardino, Corona, and surrounding areas' },
  { name: 'Greater Orange County', description: 'Irvine, Anaheim, Santa Ana, and beyond' },
  { name: 'Los Angeles', description: 'LA County communities and neighborhoods' },
  { name: 'Murrieta & Temecula', description: 'Our home base — fast response times guaranteed' }
];

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Maria G.',
    location: 'Murrieta, CA',
    text: `They came out at 11pm when our water heater burst. Professional, quick, and fair pricing. This is our plumber for life!`,
    rating: 5
  },
  {
    name: 'Robert T.',
    location: 'Corona, CA',
    text: `Finally found a plumber I can trust. They explained everything, showed me the problem, and fixed it right. Highly recommend!`,
    rating: 5
  },
  {
    name: 'Jennifer L.',
    location: 'Irvine, CA',
    text: `Family-owned and it shows. They treated my home with respect and solved a drain issue other plumbers couldn't figure out.`,
    rating: 5
  }
];

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What areas do you serve?',
    answer: `We serve the Inland Empire, Greater Orange County, and Los Angeles areas. Our headquarters is in ${WORKSPACE_LOCATION}, giving us fast response times throughout Southern California.`
  },
  {
    question: 'Do you offer 24/7 emergency service?',
    answer: `Yes! Plumbing emergencies don't wait for business hours, and neither do we. Call ${WORKSPACE_PHONE} anytime — day or night, weekends and holidays included — and we'll dispatch a technician to your location.`
  },
  {
    question: 'Are you licensed and insured?',
    answer: 'Absolutely. All our technicians are fully licensed and insured. We carry comprehensive liability insurance to protect your home and give you peace of mind.'
  },
  {
    question: 'How much does it cost?',
    answer: `We provide upfront, honest pricing before starting any work. No hidden fees, no surprises. We'll assess your situation and give you a clear quote so you can make an informed decision.`
  },
  {
    question: 'How quickly can you get to me?',
    answer: `For emergencies, we aim to arrive within the hour when possible. For scheduled appointments, we offer same-day and next-day service throughout our service area.`
  },
  {
    question: 'Do you guarantee your work?',
    answer: `Yes. We stand behind our workmanship. If something we repaired has an issue, we'll come back and make it right. Quality work is our reputation.`
  }
];

// === SECTION 3: UTILITY FUNCTIONS ===

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

const injectFonts = () => {
  if (!document.querySelector('link[href*="Montserrat"]')) {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  const style = document.createElement('style');
  style.textContent = `
    :root { --brand-font: '${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif; }
    body { font-family: '${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif; background: #f8fafc; }
    a[href^="tel:"] { text-decoration: none; }
  `;
  document.head.appendChild(style);
};

const formatPhoneForTel = (phone: string) => {
  return phone.replace(/[^0-9]/g, '');
};

// === SECTION 4: HERO SECTION ===

const HeroSection: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section id="hero" className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Video */}
      <video
        src={WORKSPACE_HERO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Dark Overlay for Contrast */}
      <div className="absolute inset-0 bg-black/60 z-[1]" />

      {/* Content */}
      <div className={`relative z-10 text-center px-4 max-w-4xl mx-auto transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="inline-block px-4 py-1.5 mb-6 border border-white/30 rounded-full bg-white/10 backdrop-blur-sm">
          <span data-section="hero-badge" className="text-sm font-bold tracking-wide uppercase" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>
            Family-Owned • Licensed & Insured
          </span>
        </div>

        <h1 data-section="hero-title" className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
          24/7 Emergency Plumbing<br />
          <span className="text-white/90">Family-Owned, Trusted Service</span>
        </h1>

        <p data-section="hero-subtitle" className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl mx-auto">
          Serving Inland Empire, Greater OC & Los Angeles
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <a
            href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`}
            data-section="cta-primary"
            className="inline-flex items-center gap-3 px-8 py-4 text-lg font-bold transition-all duration-200 hover:scale-105 shadow-xl rounded-lg"
            style={{
              backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
              color: '#ffffff',
              boxShadow: `0 4px 20px ${WORKSPACE_HIGHLIGHT_COLOR}60`
            }}
          >
            <span className="text-2xl">📞</span>
            Call Now: {WORKSPACE_PHONE}
          </a>
          <button
            data-section="cta-secondary"
            onClick={() => scrollToSection('contact')}
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white border-2 border-white/40 hover:border-white/80 transition-all duration-200 hover:bg-white/10 rounded-lg"
          >
            Request Service
          </button>
        </div>

        {/* Trust indicators */}
        <div className={`mt-12 flex flex-wrap justify-center gap-6 md:gap-12 transition-all duration-1000 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>24/7</div>
            <div className="text-xs text-white/60 uppercase tracking-wider mt-1">Emergency Service</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>100%</div>
            <div className="text-xs text-white/60 uppercase tracking-wider mt-1">Satisfaction Guaranteed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold" style={{ color: WORKSPACE_HIGHLIGHT_COLOR, fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>★★★★★</div>
            <div className="text-xs text-white/60 uppercase tracking-wider mt-1">5-Star Reviews</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <button onClick={() => scrollToSection('services')} className="text-white/60 hover:text-white transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </section>
  );
};

// === SECTION 5: SERVICES SECTION ===

const ServicesSection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-white relative" id="services" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <span data-section="services-label" className="text-sm font-bold tracking-widest uppercase" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>
            Our Services
          </span>
          <h2 data-section="services-title" className="text-3xl md:text-5xl font-bold mt-4" style={{ color: WORKSPACE_PRIMARY_COLOR, fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
            Professional Plumbing Services
          </h2>
          <p data-section="services-subtitle" className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
            From emergency repairs to routine maintenance, our licensed technicians handle it all with expertise and care.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((service, index) => (
            <div
              key={service.id}
              className={`p-6 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-500 group ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <h3 data-section={`service-${index + 1}-title`} className="text-xl font-bold mb-2" style={{ color: WORKSPACE_PRIMARY_COLOR, fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
                {service.title}
              </h3>
              <p data-section={`service-${index + 1}-desc`} className="text-gray-600 leading-relaxed">
                {service.description}
              </p>
              <div
                className="w-0 h-1 mt-4 rounded-full transition-all duration-300 group-hover:w-16"
                style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }}
              />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`}
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-bold text-white rounded-lg transition-all duration-200 hover:scale-105"
            style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }}
          >
            <span className="text-xl">📞</span> Call {WORKSPACE_PHONE} for Service
          </a>
        </div>
      </div>
    </section>
  );
};

// === SECTION 6: WHY CHOOSE US ===

const WhyChooseUsSection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 relative" id="why-us" ref={sectionRef} style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <span data-section="why-us-label" className="text-sm font-bold tracking-widest uppercase" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>
            Why Choose Us
          </span>
          <h2 data-section="why-us-title" className="text-3xl md:text-5xl font-bold text-white mt-4" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
            The Masterflow Difference
          </h2>
          <p data-section="why-us-subtitle" className="text-lg text-white/70 mt-4 max-w-2xl mx-auto">
            We're not just plumbers — we're your neighbors. Family-owned and committed to honest, quality service.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WHY_CHOOSE_US.map((item, index) => (
            <div
              key={index}
              className={`p-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/15 transition-all duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <h3 data-section={`why-us-${index + 1}-title`} className="text-xl font-bold text-white mb-2" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
                {item.title}
              </h3>
              <p data-section={`why-us-${index + 1}-desc`} className="text-white/70 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 7: SERVICE AREAS ===

const ServiceAreasSection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-gray-50 relative" id="areas" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <span data-section="areas-label" className="text-sm font-bold tracking-widest uppercase" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>
            Service Areas
          </span>
          <h2 data-section="areas-title" className="text-3xl md:text-5xl font-bold mt-4" style={{ color: WORKSPACE_PRIMARY_COLOR, fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
            Serving Southern California
          </h2>
          <p data-section="areas-subtitle" className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
            Based in {WORKSPACE_LOCATION}, we proudly serve communities throughout the region with fast response times.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICE_AREAS.map((area, index) => (
            <div
              key={index}
              className={`p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center transition-all duration-500 hover:shadow-md ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${WORKSPACE_HIGHLIGHT_COLOR}20` }}>
                📍
              </div>
              <h4 className="font-bold text-gray-900 mb-1">{area.name}</h4>
              <p className="text-sm text-gray-600">{area.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 mt-8">
          Not sure if we serve your area? <a href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`} className="font-semibold hover:underline" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>Give us a call</a> — we'll do our best to help!
        </p>
      </div>
    </section>
  );
};

// === SECTION 8: TESTIMONIALS ===

const TestimonialsSection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-white relative" id="testimonials" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <span data-section="testimonials-label" className="text-sm font-bold tracking-widest uppercase" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>
            Customer Reviews
          </span>
          <h2 data-section="testimonials-title" className="text-3xl md:text-5xl font-bold mt-4" style={{ color: WORKSPACE_PRIMARY_COLOR, fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
            What Our Customers Say
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial, index) => (
            <div
              key={index}
              className={`p-6 bg-gray-50 rounded-xl border border-gray-100 transition-all duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <span key={i} className="text-lg">⭐</span>
                ))}
              </div>
              <p className="text-gray-600 mb-4 italic">{testimonial.text}</p>
              <p className="font-bold text-gray-900">{testimonial.name}</p>
              <p className="text-sm text-gray-500">{testimonial.location}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 9: FAQ ===

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-gray-50 relative" id="faq" ref={sectionRef}>
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-16">
          <span data-section="faq-label" className="text-sm font-bold tracking-widest uppercase" style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>
            FAQ
          </span>
          <h2 data-section="faq-title" className="text-3xl md:text-5xl font-bold mt-4" style={{ color: WORKSPACE_PRIMARY_COLOR, fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={index}
              className={`border border-gray-200 bg-white rounded-xl overflow-hidden transition-all duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left font-bold text-gray-900 hover:bg-gray-50 transition-colors flex justify-between items-center"
              >
                {item.question}
                <span className={`text-xl transition-transform ${openIndex === index ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-gray-600">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 10: CTA SECTION ===

const CTASection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 relative overflow-hidden" id="contact" ref={sectionRef} style={{ backgroundColor: WORKSPACE_PRIMARY_COLOR }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }} />
      </div>

      <div className={`relative z-10 text-center max-w-3xl mx-auto px-4 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <h2 data-section="cta-title" className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
          Need a Plumber?<br />
          <span style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}>We're Here 24/7</span>
        </h2>
        <p data-section="cta-description" className="text-xl text-white/80 mb-10 max-w-xl mx-auto">
          Don't let plumbing problems ruin your day. Call {WORKSPACE_FULL_NAME} for fast, reliable service you can trust.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`}
            data-section="cta-button"
            className="inline-flex items-center gap-3 px-10 py-5 text-xl font-bold transition-all duration-200 hover:scale-105 rounded-lg"
            style={{
              backgroundColor: WORKSPACE_HIGHLIGHT_COLOR,
              color: '#ffffff',
              boxShadow: `0 4px 30px ${WORKSPACE_HIGHLIGHT_COLOR}50`
            }}
          >
            <span className="text-2xl">📞</span>
            Call {WORKSPACE_PHONE}
          </a>
        </div>

        <p data-section="cta-subtext" className="text-white/50 text-sm mt-6">
          Based in {WORKSPACE_LOCATION} • Serving Southern California
        </p>
      </div>
    </section>
  );
};

// === SECTION 11: FOOTER ===

const Footer: React.FC = () => (
  <footer className="py-12 bg-gray-900">
    <div className="max-w-7xl mx-auto px-4">
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {/* Brand */}
        <div>
          <h3 data-section="footer-brand" className="text-xl font-bold text-white mb-4" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
            {WORKSPACE_FULL_NAME}
          </h3>
          <p className="text-gray-400 mb-4">
            Family-owned plumbing company serving Southern California with 24/7 emergency service. Licensed, insured, and committed to quality.
          </p>
          <a
            href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`}
            className="inline-flex items-center gap-2 font-bold text-lg"
            style={{ color: WORKSPACE_HIGHLIGHT_COLOR }}
          >
            📞 {WORKSPACE_PHONE}
          </a>
        </div>

        {/* Service Areas */}
        <div>
          <h4 className="text-white font-bold mb-4">Service Areas</h4>
          <ul className="space-y-2 text-gray-400">
            <li>Inland Empire</li>
            <li>Greater Orange County</li>
            <li>Los Angeles</li>
            <li>Murrieta & Temecula</li>
          </ul>
        </div>

        {/* Contact & Social */}
        <div>
          <h4 className="text-white font-bold mb-4">Connect With Us</h4>
          <ul className="space-y-2 text-gray-400">
            <li>
              <a href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`} className="hover:text-white transition-colors">
                📞 {WORKSPACE_PHONE}
              </a>
            </li>
            <li>
              <a href={`https://instagram.com/${WORKSPACE_INSTAGRAM.replace('@', '')}`} className="hover:text-white transition-colors">
                📱 {WORKSPACE_INSTAGRAM}
              </a>
            </li>
            <li>{WORKSPACE_LOCATION}</li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p data-section="footer-copyright" className="text-gray-500 text-sm">
          © {new Date().getFullYear()} {WORKSPACE_FULL_NAME}. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <button onClick={() => scrollToSection('services')} className="text-gray-500 hover:text-white transition-colors text-sm">
            Services
          </button>
          <button onClick={() => scrollToSection('why-us')} className="text-gray-500 hover:text-white transition-colors text-sm">
            Why Us
          </button>
          <button onClick={() => scrollToSection('areas')} className="text-gray-500 hover:text-white transition-colors text-sm">
            Areas
          </button>
          <button onClick={() => scrollToSection('faq')} className="text-gray-500 hover:text-white transition-colors text-sm">
            FAQ
          </button>
        </div>
      </div>
    </div>
  </footer>
);

// === SECTION 12: MAIN COMPONENT ===

const MasterflowLandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    injectFonts();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroEl = document.getElementById('hero');
      const heroHeight = heroEl?.offsetHeight || 600;
      setScrolled(window.scrollY > heroHeight * 0.7);

      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const progress = docHeight - winHeight > 0 ? (scrollY / (docHeight - winHeight)) * 100 : 0;
      setScrollProgress(Math.min(progress, 100));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Services', id: 'services' },
    { label: 'Why Us', id: 'why-us' },
    { label: 'Areas', id: 'areas' },
    { label: 'FAQ', id: 'faq' }
  ];

  return (
    <div className="min-h-full overflow-y-auto bg-gray-50" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 z-[60] h-1 transition-all duration-150"
        style={{
          width: `${scrollProgress}%`,
          backgroundColor: WORKSPACE_HIGHLIGHT_COLOR
        }}
      />

      {/* Floating navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 md:px-6 md:pt-6">
        <nav
          className={`relative mx-auto max-w-6xl rounded-full backdrop-blur-md px-6 py-3 transition-all duration-300 shadow-lg flex items-center justify-between ${
            scrolled
              ? 'bg-white/95 text-gray-900 border border-gray-200/50'
              : 'bg-black/40 text-white'
          }`}
        >
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <span data-section="nav-brand" className="font-bold text-lg" style={{ fontFamily: `'${WORKSPACE_TYPOGRAPHY}', system-ui, sans-serif` }}>
              {WORKSPACE_BRAND_NAME}
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className="text-sm font-medium transition-colors hover:opacity-80"
              >
                {link.label}
              </button>
            ))}
            <a
              href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`}
              data-section="nav-cta"
              className="rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 hover:scale-105 flex items-center gap-2"
              style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR, color: '#ffffff' }}
            >
              📞 Call Now
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden flex flex-col gap-1.5"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className={`block w-5 h-0.5 transition-all duration-200 ${scrolled ? 'bg-gray-900' : 'bg-white'} ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 transition-all duration-200 ${scrolled ? 'bg-gray-900' : 'bg-white'} ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 transition-all duration-200 ${scrolled ? 'bg-gray-900' : 'bg-white'} ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </nav>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mx-auto max-w-6xl mt-2 rounded-2xl bg-white border border-gray-200 p-4 shadow-xl">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  scrollToSection(link.id);
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left text-gray-700 hover:text-gray-900 py-3 px-4 text-sm font-medium border-b border-gray-100 last:border-0"
              >
                {link.label}
              </button>
            ))}
            <a
              href={`tel:${formatPhoneForTel(WORKSPACE_PHONE)}`}
              className="flex items-center justify-center gap-2 mt-3 text-center rounded-full py-3 text-sm font-bold text-white"
              style={{ backgroundColor: WORKSPACE_HIGHLIGHT_COLOR }}
            >
              <span>📞</span> Call {WORKSPACE_PHONE}
            </a>
          </div>
        )}
      </div>

      {/* Page sections */}
      <HeroSection />
      <ServicesSection />
      <WhyChooseUsSection />
      <ServiceAreasSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
};

// === SECTION 13: EXPORT (FINAL) ===

export default MasterflowLandingPage;

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<MasterflowLandingPage />);
