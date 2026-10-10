export type Lang = 'tr' | 'en';

export const site = {
  name: 'Gelengi Tech',
  legal: 'Gelengi Yazılım Teknoloji A.Ş.',
  phone: '+90 532 203 77 94',
  phoneHref: 'tel:+905322037794',
  email: 'info@gelengitech.com.tr',
  address: 'Konya Teknokent, Akademi Mah. Gürbulut Sk. No:67 H144-C, Selçuklu / Konya',
  linkedin: 'https://www.linkedin.com/in/erhanozer/',
};

export const paths = {
  tr: { home: '/', services: '/hizmetler/', work: '/calismalar/', about: '/hakkimizda/', contact: '/iletisim/' },
  en: { home: '/en/', services: '/en/services/', work: '/en/work/', about: '/en/about/', contact: '/en/contact/' },
};

export const t = {
  tr: {
    nav: { services: 'Hizmetler', work: 'Çalışmalar', about: 'Hakkımızda', contact: 'İletişim', cta: 'Görüşme planlayın', switch: 'EN' },
    meta: {
      home: { title: 'Gelengi Tech — Finans kurumları için teknoloji, strateji ve program yönetimi danışmanlığı', desc: 'Bankalar ve finans kurumları için hazine sistemleri (Murex MX.3), temel bankacılık entegrasyonu, veri mimarisi ve GenAI Ar-Ge. Konya Teknokent.' },
      services: { title: 'Hizmetler — Gelengi Tech', desc: 'Teknoloji ve strateji danışmanlığı, program yönetimi, hazine sistemleri, veri ve yapay zekâ.' },
      work: { title: 'Çalışmalar — Gelengi Tech', desc: 'Seçili projeler ve Ar-Ge çalışmaları.' },
      about: { title: 'Hakkımızda — Gelengi Tech', desc: 'Gelengi Tech kimdir, nasıl çalışır.' },
      contact: { title: 'İletişim — Gelengi Tech', desc: 'Görüşme planlayın.' },
    },
    hero: {
      kicker: 'Finans kurumları için teknoloji ve strateji danışmanlığı',
      title: 'Bankacılık teknolojisinde kararı doğru verdiren deneyim.',
      lead: 'Gelengi Tech; bankalara ve finans kurumlarına hazine sistemleri, temel bankacılık entegrasyonu ve veri mimarisi konularında üst düzey danışmanlık ve program yönetimi sağlar. Konya Teknokent’te GenAI tabanlı hazine çözümleri üzerine Ar-Ge yürütür.',
      primary: 'Hizmetleri inceleyin',
      secondary: 'Bize ulaşın',
    },
    pillars: {
      heading: 'Ne yapıyoruz',
      items: [
        { title: 'Teknoloji ve strateji danışmanlığı', body: 'Mevcut mimarinizi, tedarikçi yapınızı ve yol haritanızı birlikte değerlendirir; yatırım kararlarını iş hedefleriyle hizalarız. Tedarikçi seçimi, RFP hazırlığı ve değerlendirme süreçlerinde yanınızdayız.' },
        { title: 'Program ve proje yönetimi', body: 'Çok paydaşlı dönüşüm programlarını — entegratör, yazılım üreticisi ve banka ekipleri arasında — planlar, yönetir ve raporlarız. Kapsam, takvim, risk ve değişiklik yönetimi tek elden yürür.' },
        { title: 'Hazine sistemleri ve Murex MX.3', body: 'MX.3 implementasyon ve entegrasyon programlarında proje yönetimi, temel bankacılık ile entegrasyon tasarımı ve kabul süreçlerinin koordinasyonu.' },
        { title: 'Veri, analitik ve GenAI', body: 'Hazine veri modelleri, anomali algılama, yasal raporlama doğrulama ve doğal dilde sorgulanabilen karar destek asistanları. Teknokent Ar-Ge birikimimizi kurumunuza taşırız.' },
      ],
    },
    proof: {
      heading: 'Nerede fark yaratırız',
      items: [
        { k: 'Hazine ve finansal piyasalar', v: 'Murex MX.3 ön ofis, FX/türev işlem platformları, implementasyon ve entegrasyon programları' },
        { k: 'Temel bankacılık ve ALM', v: 'Yeni nesil temel bankacılık platformu teslimatı; ALM, FTP ve kârlılık (OFSAA) programları' },
        { k: 'Ar-Ge', v: 'Konya Teknokent’te ardışık dört hazine veri modeli ve GenAI projesi' },
        { k: 'Çalışma modeli', v: 'Kurumunuzun ekibinin yanında, isimli ve kıdemli kaynakla' },
      ],
    },
    work: {
      heading: 'Seçili çalışmalar',
      intro: 'Müşteri gizliliği gereği bazı kurum adları paylaşılmamaktadır; referans görüşmeleri talep üzerine düzenlenir.',
      items: [
        { title: 'Murex MX.3 implementasyonunda program yönetimi', tag: 'Hazine sistemleri · Bankacılık', body: 'Bir Türk bankasının MX.3 implementasyon ve entegrasyon programında, uluslararası MX.3 entegratörüne kıdemli proje yönetimi: planlama, yönetişim, risk ve değişiklik yönetimi, temel bankacılık entegrasyon koordinasyonu ve KPI raporlaması.' },
        { title: 'Yeni nesil temel bankacılık platformunun bankalara teslimatı', tag: 'Temel bankacılık · Teslimat yönetimi', body: 'Bir temel bankacılık platformu üreticisi adına, üç bankada uyarlamadan canlıya geçişe kadar uçtan uca teslimat yönetimi. Her kurum için yapılandırılmış geçiş ve hypercare protokolleriyle canlı sonrası destek olayları yaklaşık %40 azaltıldı; standart gereksinim ve geri bildirim döngüleriyle devreye alma süreleri kısaltıldı.' },
        { title: 'AI destekli hazine veri modeli', tag: 'Ar-Ge · Konya Teknokent', body: 'Finans kurumları için ETL, datamart, ensemble ML tabanlı anomali algılama, yasal raporlama doğrulama kural seti ve doğal dilde sorgulanabilen dashboard. Hibrit buluta taşındı; Temmuz 2026’da tamamlandı.' },
        { title: 'Treasury Copilot — GenAI destekli hazine karar asistanı', tag: 'Ar-Ge · 2026–2027', body: 'LLM + RAG + NL2SQL mimarisiyle, kaynak gösteren ve halüsinasyon kontrollü bir hazine karar destek asistanı. Türkçe finansal domain için model adaptasyonu ve guardrail katmanı üzerine çalışıyoruz.' },
      ],
    },
    about: {
      heading: 'Hakkımızda',
      p1: 'Gelengi Tech, Konya Teknokent’te yerleşik bir teknoloji ve yönetim danışmanlığı şirketidir. Finans sektöründe sistem entegrasyonu, hazine teknolojileri ve dönüşüm programları üzerine çalışıyoruz.',
      p2: 'Kurucumuz Erhan Özer, bankacılık teknolojisinde 25 yılı aşkın deneyime sahiptir. Odeabank’ta on yılı aşkın süre proje yönetimi, iş analizi ve uygulama destek birimlerinin başında görev yaptı; Murex hazine ön ofisi, FX/türev işlem platformu, AML/uyum paketi ve OFSAA tabanlı entegre finansal kaynak yönetimi (ALM, FTP, kârlılık) programlarını yönetti, BDDK denetimlerini ve teknoloji bütçesini koordine etti. Daha önce Fortis, Eurobank Tekfen ve Intertech’te veri ambarı, CRM, finansal kontrol ve temel bankacılık projelerinde görev aldı.',
      p3: 'Büyük bir ekip yerine kıdemli ve isimli kaynakla çalışırız; çok paydaşlı programlarda bankanın, entegratörün ve yazılım üreticisinin aynı dili konuşmasını sağlarız. Taahhüt ettiğimiz kişi, projede fiilen çalışan kişidir.',
      facts: [
        { k: 'Kuruluş', v: 'Konya Teknokent' },
        { k: 'Odak', v: 'Bankacılık ve hazine teknolojileri' },
        { k: 'Ar-Ge', v: 'Teknokent onaylı projeler, aylık ilerleme raporlaması' },
        { k: 'Diller', v: 'Türkçe, İngilizce' },
      ],
    },
    contact: {
      heading: 'Görüşme planlayın',
      lead: 'Bir programın başında mısınız, bir tedarikçi kararı mı veriyorsunuz, ya da veri ve yapay zekâ tarafında bir fikri test etmek mi istiyorsunuz? Kısa bir görüşmeyle nerede yardımcı olabileceğimizi netleştirelim.',
      emailLabel: 'E-posta',
      phoneLabel: 'Telefon',
      addressLabel: 'Adres',
      button: 'E-posta gönderin',
    },
    footer: { rights: 'Tüm hakları saklıdır.', tagline: 'Finans kurumları için teknoloji, strateji ve program yönetimi.' },
  },
  en: {
    nav: { services: 'Services', work: 'Work', about: 'About', contact: 'Contact', cta: 'Book a call', switch: 'TR' },
    meta: {
      home: { title: 'Gelengi Tech — Technology, strategy and programme management consulting for financial institutions', desc: 'Treasury systems (Murex MX.3), core banking integration, data architecture and GenAI R&D for banks and financial institutions. Konya Teknokent, Turkey.' },
      services: { title: 'Services — Gelengi Tech', desc: 'Technology and strategy consulting, programme management, treasury systems, data and AI.' },
      work: { title: 'Work — Gelengi Tech', desc: 'Selected projects and R&D.' },
      about: { title: 'About — Gelengi Tech', desc: 'Who we are and how we work.' },
      contact: { title: 'Contact — Gelengi Tech', desc: 'Book a call.' },
    },
    hero: {
      kicker: 'Technology and strategy consulting for financial institutions',
      title: 'Experience that makes the right call in banking technology.',
      lead: 'Gelengi Tech provides senior consulting and programme management to banks and financial institutions on treasury systems, core banking integration and data architecture, and runs R&D on GenAI-powered treasury solutions at Konya Teknokent, Turkey.',
      primary: 'See our services',
      secondary: 'Get in touch',
    },
    pillars: {
      heading: 'What we do',
      items: [
        { title: 'Technology and strategy consulting', body: 'We assess your architecture, vendor landscape and roadmap with you, and align investment decisions with business goals. We support vendor selection, RFP preparation and evaluation.' },
        { title: 'Programme and project management', body: 'We plan, run and report multi-party transformation programmes across integrator, software vendor and bank teams. Scope, schedule, risk and change are managed in one place.' },
        { title: 'Treasury systems and Murex MX.3', body: 'Project management for MX.3 implementation and integration programmes, integration design with core banking, and coordination of acceptance.' },
        { title: 'Data, analytics and GenAI', body: 'Treasury data models, anomaly detection, regulatory reporting validation and natural-language decision assistants. We bring our Teknokent R&D into your institution.' },
      ],
    },
    proof: {
      heading: 'Where we make a difference',
      items: [
        { k: 'Treasury and capital markets', v: 'Murex MX.3 front office, FX and derivatives trading platforms, implementation and integration programmes' },
        { k: 'Core banking and ALM', v: 'Next-generation core banking platform delivery; ALM, FTP and profitability (OFSAA) programmes' },
        { k: 'R&D', v: 'Four successive treasury data model and GenAI projects at Konya Teknokent' },
        { k: 'Engagement model', v: 'Named senior resources working alongside your team' },
      ],
    },
    work: {
      heading: 'Selected work',
      intro: 'Some client names are withheld for confidentiality; reference calls are available on request.',
      items: [
        { title: 'Programme management for a Murex MX.3 implementation', tag: 'Treasury systems · Banking', body: 'Senior project management for an international MX.3 integrator on a Turkish bank’s MX.3 implementation and integration programme: planning, governance, risk and change management, core banking integration coordination and KPI reporting.' },
        { title: 'Delivery of a next-generation core banking platform to banks', tag: 'Core banking · Delivery management', body: 'End-to-end delivery management on behalf of a core banking platform vendor across three banks, from customisation to production go-live. Structured transition and hypercare protocols cut post-go-live incidents by around 40%; standardised requirement and feedback loops shortened onboarding.' },
        { title: 'AI-powered treasury data model', tag: 'R&D · Konya Teknokent', body: 'ETL, datamart, ensemble-ML anomaly detection, a regulatory reporting validation rule set and a natural-language dashboard for financial institutions. Migrated to hybrid cloud; completed July 2026.' },
        { title: 'Treasury Copilot — GenAI-powered treasury decision assistant', tag: 'R&D · 2026–2027', body: 'A citation-backed, hallucination-controlled treasury decision assistant on an LLM + RAG + NL2SQL architecture, with model adaptation and a guardrail layer for the Turkish financial domain.' },
      ],
    },
    about: {
      heading: 'About',
      p1: 'Gelengi Tech is a technology and management consultancy based at Konya Teknokent, Turkey. We work on systems integration, treasury technology and transformation programmes in financial services.',
      p2: 'Our founder, Erhan Özer, has more than 25 years in banking technology. He led project management, business analysis and application support at Odeabank for over a decade, running the Murex treasury front office, FX and derivatives trading platform, AML/compliance suite and OFSAA-based integrated financial resource management (ALM, FTP, profitability) programmes, and coordinating BRSA audits and the technology budget. Earlier roles at Fortis, Eurobank Tekfen and Intertech covered data warehouse, CRM, financial control and core banking projects.',
      p3: 'We work with named senior resources rather than a large bench, and keep the bank, the integrator and the software vendor speaking the same language on multi-party programmes. The person we commit is the person who does the work.',
      facts: [
        { k: 'Based in', v: 'Konya Teknokent, Turkey' },
        { k: 'Focus', v: 'Banking and treasury technology' },
        { k: 'R&D', v: 'Teknokent-approved projects with monthly progress reporting' },
        { k: 'Languages', v: 'Turkish, English' },
      ],
    },
    contact: {
      heading: 'Book a call',
      lead: 'Starting a programme, choosing a vendor, or testing an idea on the data and AI side? A short call will tell us where we can help.',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
      addressLabel: 'Address',
      button: 'Send an email',
    },
    footer: { rights: 'All rights reserved.', tagline: 'Technology, strategy and programme management for financial institutions.' },
  },
} as const;
