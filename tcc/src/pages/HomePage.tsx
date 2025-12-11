import { useMemo } from 'react'
import { Link } from 'react-router-dom'

const evolutionSteps = [
  {
    stage: 'Stage 1',
    title: 'Tropical Cloud Cluster',
    detail: 'Disorganized convection begins to cluster over warm ocean waters. No defined circulation center exists yet.',
  },
  {
    stage: 'Stage 2',
    title: 'Tropical Disturbance',
    detail:
      'Convection becomes more organized with a weak low-pressure area forming. Wind speeds remain below 25 knots.',
  },
  {
    stage: 'Stage 3',
    title: 'Tropical Depression',
    detail:
      'A closed circulation develops with sustained winds of 25-33 knots. The system receives an official designation.',
  },
  {
    stage: 'Stage 4',
    title: 'Tropical Storm',
    detail:
      'Winds strengthen to 34-63 knots with a more defined structure. The storm receives a name.',
  },
  {
    stage: 'Stage 5',
    title: 'Tropical Cyclone',
    detail:
      'Winds exceed 64 knots with a well-defined eye. The system becomes a hurricane/typhoon/cyclone depending on basin.',
  },
]

const algorithmCards = [
  {
    title: 'Convolutional Neural Networks (CNN)',
    bullets: ['Multi-scale feature extraction', 'Spatial pattern recognition', 'Real-time inference capability'],
  },
  {
    title: 'Recurrent Neural Networks (LSTM)',
    bullets: ['Temporal pattern learning', 'Trajectory prediction', '72-hour forecasting'],
  },
  {
    title: 'U-Net Segmentation',
    bullets: ['Pixel-level classification', 'Boundary detection', 'Area quantification'],
  },
  {
    title: 'Ensemble Methods',
    bullets: ['Multi-model fusion', 'Confidence scoring', 'Uncertainty quantification'],
  },
]

const detectionSteps = [
  'Extract IRBT',
  'Apply temperature threshold (Tb ≤ 240K)',
  'Cluster cold pixels with DBSCAN',
  'Use U-Net segmentation',
  'Filter valid TCCs by area and radius',
]

const trackingSteps = [
  'Compare sequential satellite images',
  'Centroid matching of detected clusters',
  'Assess shape similarity across frames',
  'Assign unique Track IDs and paths',
]

const predictionBullets = [
  'Track cooling rate, area growth, and intensity over time',
  'Extract temporal features for each cluster',
  'Predict cyclone probability with LSTM / ConvLSTM',
]

const statItems = [
  { label: 'Detection Accuracy', value: '95%+' },
  { label: 'Prediction Window', value: '72hr' },
  { label: 'Processing Speed', value: 'Real-time' },
  { label: 'Coverage Area', value: 'Global' },
]

const keyFactors = [
  { value: '> 26.5°C', label: 'Sea Surface Temperature', detail: 'Warm ocean waters provide the energy source through evaporation and latent heat release.' },
  { value: '< 10 m/s', label: 'Vertical Wind Shear', detail: 'Low wind shear allows the storm structure to remain vertically aligned and strengthen.' },
  { value: '> 5° latitude', label: 'Coriolis Effect', detail: 'Sufficient distance from the equator provides the rotation needed for cyclonic development.' },
]

function HomePage() {
  const heroBackground = useMemo(
    () => ({
      backgroundImage:
        "linear-gradient(180deg, rgba(10,17,30,0.92) 0%, rgba(11,18,32,0.9) 60%, rgba(11,18,32,0.98) 100%), url('https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?auto=format&fit=crop&w=1600&q=80')",
    }),
    [],
  )

  return (
    <>
      <section
        className="relative flex min-h-screen items-center pt-28"
        style={heroBackground}
      >
        <div className="absolute inset-0 bg-[#0b1220]/80" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
          <div className="flex flex-col gap-6 lg:w-4/5">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-accent shadow-glow">
              <span className="text-lg">🛰️</span> AI-Powered Weather Intelligence
            </div>
            <h2 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Tropical Cloud Cluster <br /> Detection &amp; Prediction
            </h2>
            <p className="text-lg leading-relaxed text-slate-200">
              Advanced artificial intelligence for detecting, tracking, and predicting the evolution of Tropical Cloud
              Clusters into tropical cyclones. Empowering meteorologists with cutting-edge deep learning technology.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/tools"
                className="rounded-2xl bg-gradient-to-r from-accent to-accentDark px-6 py-3 text-base font-semibold text-midnight shadow-glow transition hover:brightness-110"
              >
                Try Detection Tools →
              </Link>
              <a
                href="#about"
                className="rounded-2xl border border-white/15 px-6 py-3 text-base font-semibold text-white transition hover:border-accent hover:text-accent"
              >
                Learn More
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statItems.map((stat) => (
              <div
                key={stat.label}
                className="glass flex h-28 flex-col items-center justify-center rounded-2xl"
              >
                <p className="text-2xl font-extrabold text-accent">{stat.value}</p>
                <p className="text-sm text-slate-300">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div className="text-center">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-accent shadow-glow">
              <span className="text-lg">☁️</span> Understanding TCCs
            </div>
          <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">What are Tropical Cloud Clusters?</h3>
          <p className="mt-4 text-base text-slate-300">
            Tropical Cloud Clusters are the precursors to some of Earth&apos;s most powerful weather systems.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded-3xl shadow-2xl">
            <img
              className="h-full w-full object-cover"
              src="https://polished-pony-114.convex.cloud/api/storage/32f1b9e8-506c-4be7-b38b-41059a6dec93"
              alt="Satellite imagery of developing TCC"
            />
            <div className="bg-gradient-to-r from-accent to-accentDark px-4 py-3 text-sm font-semibold text-midnight">
              Satellite imagery of developing TCC
            </div>
          </div>
          <div className="space-y-4">
            <AboutCard
              title="Definition"
              text="Tropical Cloud Clusters (TCCs) are organized systems of convective clouds that form over warm tropical oceans. They appear as clusters of thunderstorms on satellite imagery, typically spanning 100–600 km in diameter, and represent the earliest identifiable stage of potential tropical cyclone development."
            />
            <AboutCard
              title="Formation Conditions"
              text="TCCs form when sea surface temperatures exceed 26.5°C, combined with low vertical wind shear, sufficient Coriolis force (typically 5° or more from the equator), and atmospheric instability. These conditions allow deep convection to organize and potentially intensify."
              icon="layers"
            />
            <AboutCard
              title="Why They Matter"
              text="While only 10–20% of TCCs develop into tropical cyclones, identifying which ones will intensify is crucial for early warning systems. Early detection can provide 3–5 additional days of preparation time for coastal communities."
              icon="alert"
            />
          </div>
        </div>
      </section>

      <section id="science" className="relative z-10 bg-ocean/60 py-16">
        <div className="mx-auto max-w-6xl space-y-12 px-6">
          <div className="text-center">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-accent shadow-glow">
              <span className="text-lg">🌀</span> Cyclogenesis Process
            </div>
            <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">From Cloud Cluster to Cyclone</h3>
            <p className="mt-4 text-base text-slate-300">
              Understanding the evolution process is key to accurate prediction. Here&apos;s how a TCC transforms into a
              powerful tropical cyclone.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {evolutionSteps.map((step, idx) => (
              <div key={step.title} className="glass divider-line h-full rounded-2xl p-5">
                <p className="text-sm font-semibold text-accent">Stage {idx + 1}</p>
                <h4 className="mt-2 text-lg font-bold text-white">{step.title}</h4>
                <p className="mt-3 text-sm text-slate-300">{step.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {keyFactors.map((factor) => (
              <div key={factor.label} className="glass rounded-2xl p-6 text-center">
                <p className="text-2xl font-extrabold text-accent">{factor.value}</p>
                <h5 className="mt-2 text-base font-semibold text-white">{factor.label}</h5>
                <p className="mt-2 text-sm text-slate-300">{factor.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="algorithms" className="relative z-10 mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-accent shadow-glow">
            <span className="text-lg">⚡</span> AI Technology
          </div>
          <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Our AI Algorithms</h3>
          <p className="mt-4 text-base text-slate-300">
            State-of-the-art deep learning models trained on decades of satellite data to detect and predict tropical
            cyclone development.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {algorithmCards.map((algo) => (
            <div key={algo.title} className="glass rounded-2xl p-6">
              <h4 className="text-xl font-bold text-white">{algo.title}</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {algo.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2 w-2 rounded-full bg-accent" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 bg-ocean/60 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-3">
          <ProcessCard
            title="How TCC Detection Works"
            subtitle="Simple steps"
            steps={detectionSteps}
            footer="Supports UN SDG 13: Climate Action using INSAT-3D Infrared Brightness Temperature (IRBT) data."
          />
          <ProcessCard
            title="How TCC Tracking Works"
            subtitle="Follow the movement"
            steps={trackingSteps}
            footer="Multiple satellite images are compared to follow cluster movement."
          />
          <ProcessCard
            title="Cyclogenesis Prediction"
            subtitle="Forecast the future"
            steps={predictionBullets}
            footer="An LSTM / ConvLSTM model predicts cyclone formation probability."
          />
        </div>
      </section>
    </>
  )
}

function AboutCard({ title, text, icon }: { title: string; text: string; icon?: 'layers' | 'alert' }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white/10 p-2 text-accent">
          {icon === 'layers' && <span>🧭</span>}
          {icon === 'alert' && <span>⚠️</span>}
          {!icon && <span>📘</span>}
        </span>
        <h4 className="text-lg font-bold text-white">{title}</h4>
      </div>
      <p className="mt-3 text-sm text-slate-300">{text}</p>
    </div>
  )
}

function ProcessCard({
  title,
  subtitle,
  steps,
  footer,
}: {
  title: string
  subtitle: string
  steps: string[]
  footer: string
}) {
  return (
    <div className="glass h-full rounded-2xl p-6">
      <p className="text-sm font-semibold text-accent">{subtitle}</p>
      <h4 className="mt-2 text-xl font-bold text-white">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {steps.map((step) => (
          <li key={step} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">{footer}</div>
    </div>
  )
}

export default HomePage

