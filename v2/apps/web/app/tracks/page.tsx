import Link from 'next/link';

// Mock data to be replaced with a fetch call to NestJS backend
const TRACKS = [
  { slug: 'pwn', name: 'PWN', description: 'Binary exploitation, ROP chains, and heap overflow', color: 'border-red-500' },
  { slug: 'web', name: 'Web', description: 'XSS, SQLi, SSRF, and prototype pollution', color: 'border-cyan-500' },
  { slug: 'crypto', name: 'Cryptography', description: 'Ciphers, discrete log, and broken PRNGs', color: 'border-purple-500' },
  { slug: 'forensics', name: 'Digital Forensic', description: 'Memory dump analysis and network packet inspection', color: 'border-green-500' },
];

export default function TracksPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-white">CHALLENGE TRACKS</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {TRACKS.map((track) => (
          <Link href={`/tracks/${track.slug}`} key={track.slug}>
            <div className={`p-6 bg-gray-900 border-l-4 ${track.color} rounded-md hover:bg-gray-800 transition cursor-pointer h-full shadow-lg`}>
              <h2 className="text-2xl font-bold text-white mb-2 uppercase">{track.name}</h2>
              <p className="text-gray-400 text-sm mb-4">{track.description}</p>
              
              <div className="flex justify-between items-center text-xs text-gray-500 font-mono mt-auto">
                <span>0 / 10 SOLVED</span>
                <span>ENTER TRACK →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
