import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Our Sources | MirrorSource",
  description: "MirrorSource aggregates 65+ news sources across the political spectrum. See our full source list with transparency data on ownership and editorial perspective.",
};

// Source data organized by political lean
const sourcesByLean = {
  left: [
    { name: "CNN", domain: "cnn.com", type: "Corporate" },
    { name: "MSNBC", domain: "msnbc.com", type: "Corporate" },
    { name: "The Guardian", domain: "theguardian.com", type: "International" },
    { name: "ProPublica", domain: "propublica.org", type: "Nonprofit" },
    { name: "The Intercept", domain: "theintercept.com", type: "Nonprofit" },
    { name: "Mother Jones", domain: "motherjones.com", type: "Nonprofit" },
    { name: "The New Republic", domain: "newrepublic.com", type: "Magazine" },
    { name: "Jacobin", domain: "jacobin.com", type: "Magazine" },
    { name: "Boston Globe", domain: "bostonglobe.com", type: "National" },
  ],
  "center-left": [
    { name: "NPR", domain: "npr.org", type: "Public-Trust" },
    { name: "Politico", domain: "politico.com", type: "Analysis" },
    { name: "New York Times", domain: "nytimes.com", type: "National" },
    { name: "Washington Post", domain: "washingtonpost.com", type: "National" },
    { name: "The Atlantic", domain: "theatlantic.com", type: "Magazine" },
    { name: "Vox", domain: "vox.com", type: "Corporate" },
    { name: "NBC News", domain: "nbcnews.com", type: "Corporate" },
    { name: "ABC News", domain: "abcnews.go.com", type: "Corporate" },
    { name: "CBS News", domain: "cbsnews.com", type: "Corporate" },
  ],
  center: [
    { name: "AP News", domain: "apnews.com", type: "Wire" },
    { name: "Reuters", domain: "reuters.com", type: "Wire" },
    { name: "AFP", domain: "afp.com", type: "Wire" },
    { name: "PBS", domain: "pbs.org", type: "Public-Trust" },
    { name: "BBC", domain: "bbc.com", type: "Public-Trust" },
    { name: "Al Jazeera", domain: "aljazeera.com", type: "State-Funded" },
    { name: "USA Today", domain: "usatoday.com", type: "National" },
    { name: "Axios", domain: "axios.com", type: "National" },
    { name: "The Hill", domain: "thehill.com", type: "Analysis" },
    { name: "ABC Australia", domain: "abc.net.au", type: "Public-Trust" },
    { name: "CBC", domain: "cbc.ca", type: "Public-Trust" },
    { name: "Foreign Policy", domain: "foreignpolicy.com", type: "Analysis" },
    { name: "Foreign Affairs", domain: "foreignaffairs.com", type: "Analysis" },
  ],
  "center-right": [
    { name: "Wall Street Journal", domain: "wsj.com", type: "Specialized" },
    { name: "The Dispatch", domain: "thedispatch.com", type: "Magazine" },
    { name: "The Bulwark", domain: "thebulwark.com", type: "Magazine" },
    { name: "The Telegraph", domain: "telegraph.co.uk", type: "International" },
    { name: "The Economist", domain: "economist.com", type: "Magazine" },
    { name: "Financial Times", domain: "ft.com", type: "Specialized" },
    { name: "Bloomberg", domain: "bloomberg.com", type: "Specialized" },
  ],
  right: [
    { name: "Fox News", domain: "foxnews.com", type: "Corporate" },
    { name: "New York Post", domain: "nypost.com", type: "National" },
    { name: "Washington Examiner", domain: "washingtonexaminer.com", type: "National" },
    { name: "Washington Times", domain: "washingtontimes.com", type: "National" },
    { name: "Daily Wire", domain: "dailywire.com", type: "Corporate" },
    { name: "Newsmax", domain: "newsmax.com", type: "Corporate" },
    { name: "Breitbart", domain: "breitbart.com", type: "Corporate" },
    { name: "National Review", domain: "nationalreview.com", type: "Magazine" },
    { name: "Daily Caller", domain: "dailycaller.com", type: "Corporate" },
    { name: "The Blaze", domain: "theblaze.com", type: "Corporate" },
    { name: "Free Beacon", domain: "freebeacon.com", type: "Analysis" },
    { name: "Townhall", domain: "townhall.com", type: "Corporate" },
    { name: "RedState", domain: "redstate.com", type: "Corporate" },
    { name: "The Federalist", domain: "thefederalist.com", type: "Magazine" },
    { name: "American Spectator", domain: "spectator.org", type: "Magazine" },
  ],
};

// Badge colors matching the app's taxonomy
const badgeColors: Record<string, string> = {
  Wire: "bg-blue-100 text-blue-700",
  "Public-Trust": "bg-green-100 text-green-700",
  "State-Funded": "bg-red-100 text-red-700",
  Nonprofit: "bg-teal-100 text-teal-700",
  Corporate: "bg-purple-100 text-purple-700",
  National: "bg-yellow-100 text-yellow-700",
  International: "bg-cyan-100 text-cyan-700",
  Magazine: "bg-pink-100 text-pink-700",
  Analysis: "bg-indigo-100 text-indigo-700",
  Specialized: "bg-orange-100 text-orange-700",
  Local: "bg-stone-100 text-stone-700",
};

// Badge descriptions
const badgeDescriptions: Record<string, string> = {
  Wire: "News agencies providing factual reporting to other outlets",
  "Public-Trust": "Publicly funded with editorial independence charter",
  "State-Funded": "Government funded with potential state interests",
  Nonprofit: "Donor or foundation funded, not profit-driven",
  Corporate: "Privately-owned media companies, often ad-supported",
  National: "Major national newspapers and outlets",
  International: "Non-US outlets offering global perspective",
  Magazine: "Long-form journalism and in-depth analysis",
  Analysis: "Think tanks, policy experts, and investigative outlets",
  Specialized: "Industry-focused or financial news outlets",
};

// Lean column styling
const leanStyles: Record<string, { bg: string; border: string; label: string }> = {
  left: { bg: "bg-blue-50", border: "border-blue-200", label: "Left" },
  "center-left": { bg: "bg-sky-50", border: "border-sky-200", label: "Center-Left" },
  center: { bg: "bg-slate-50", border: "border-slate-200", label: "Center" },
  "center-right": { bg: "bg-amber-50", border: "border-amber-200", label: "Center-Right" },
  right: { bg: "bg-red-50", border: "border-red-200", label: "Right" },
};

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

export default function SourcesPage() {
  const totalSources = Object.values(sourcesByLean).flat().length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="MirrorSource" width={160} height={40} className="h-9 w-auto" />
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</Link>
              <Link href="/sources" className="text-blue-600 font-medium">Sources</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        {/* Title Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Our Sources</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            MirrorSource aggregates <span className="font-semibold">{totalSources}+ news sources</span> across the political spectrum,
            giving you a complete picture of how stories are covered.
          </p>
        </div>

        {/* Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          {(Object.keys(sourcesByLean) as Array<keyof typeof sourcesByLean>).map((lean) => (
            <div
              key={lean}
              className={`rounded-xl border ${leanStyles[lean].border} ${leanStyles[lean].bg} p-4`}
            >
              <h2 className="text-lg font-bold text-slate-800 mb-4 text-center pb-2 border-b border-slate-200">
                {leanStyles[lean].label}
              </h2>
              <div className="space-y-2">
                {sourcesByLean[lean].map((source) => (
                  <div
                    key={source.domain}
                    className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={getFaviconUrl(source.domain)}
                        alt=""
                        className="w-4 h-4 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="font-medium text-slate-800 text-sm leading-tight">
                        {source.name}
                      </span>
                    </div>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full ${badgeColors[source.type] || "bg-gray-100 text-gray-700"}`}
                    >
                      {source.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Badge Legend */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 text-lg">Understanding Source Types</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(badgeDescriptions).map(([type, desc]) => (
              <div key={type} className="flex flex-col gap-1">
                <span
                  className={`inline-block text-xs px-2 py-1 rounded-full w-fit ${badgeColors[type] || "bg-gray-100 text-gray-700"}`}
                >
                  {type}
                </span>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            Political lean classifications are based on AllSides Media Bias Ratings and Ad Fontes Media Bias Chart.
            Source types reflect ownership structure and funding model. We continuously review and update our source database.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} MirrorSource</p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
            <Link href="/sources" className="hover:text-blue-600 transition-colors">Sources</Link>
            <Link href="/legal" className="hover:text-blue-600 transition-colors">Legal</Link>
            <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
