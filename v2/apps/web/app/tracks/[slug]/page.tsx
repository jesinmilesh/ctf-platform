import Link from 'next/link';

export default function TrackDetailPage({ params }: { params: { slug: string } }) {
  // Mock data for challenges inside a track
  const trackSlug = params.slug.toUpperCase();
  
  const challenges = [
    { id: 'ch-01', title: `${trackSlug} Warmup`, difficulty: 'EASY', points: 100, solved: true },
    { id: 'ch-02', title: `Deep ${trackSlug}`, difficulty: 'MEDIUM', points: 300, solved: false },
    { id: 'ch-03', title: `Ultimate ${trackSlug}`, difficulty: 'INSANE', points: 1000, solved: false },
  ];

  return (
    <div className="container mx-auto p-8">
      <Link href="/tracks" className="text-gray-400 hover:text-white mb-6 inline-block font-mono text-sm">
        ← BACK TO TRACKS
      </Link>
      
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-2">{trackSlug} OPERATIONS</h1>
        <p className="text-gray-400">Total Challenges: {challenges.length} | Available Points: 1400</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {challenges.map(ch => (
          <div key={ch.id} className="p-5 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className={`text-xs px-2 py-1 rounded font-bold ${
                ch.difficulty === 'EASY' ? 'bg-green-900/30 text-green-400' :
                ch.difficulty === 'MEDIUM' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'
              }`}>{ch.difficulty}</span>
              <span className="text-white font-mono">{ch.points} PTS</span>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">{ch.title}</h3>
            
            <div className="mt-auto pt-4 flex items-center justify-between">
              {ch.solved ? (
                <span className="text-green-500 text-sm font-bold flex items-center gap-1">
                  ✓ SOLVED
                </span>
              ) : (
                <span className="text-gray-500 text-sm font-mono">UNSOLVED</span>
              )}
              
              <Link href={`/challenges/${ch.id}`}>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded font-medium transition">
                  ACCESS
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
