export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-start bg-gradient-to-r from-white to-gray-50/50">
        <h1 className="text-3xl font-serif text-gray-900 mb-4">Terrier Cyber Quest 2026</h1>
        <p className="text-gray-600 mb-8">Kindly use the new portal for all activities and flag submissions.</p>
        
        <div className="flex gap-4">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg shadow-sm transition flex items-center gap-2">
            Open Challenges
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          
          <div className="flex flex-col items-start bg-white border rounded-lg px-4 py-2 shadow-sm">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Track Ended</span>
            <span className="font-mono text-gray-900 font-bold">00:00:00:000</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
          <h2 className="text-lg font-bold text-gray-900 self-start mb-8">Event Performance</h2>
          
          {/* Circular Progress Placeholder */}
          <div className="relative w-48 h-48 rounded-full border-8 border-indigo-50 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full border-8 border-indigo-100" style={{ clipPath: 'polygon(0 0, 0% 100%, 0 100%, 0 0)' }}></div>
            <div className="text-center">
              <span className="text-4xl font-black text-gray-900 block">0%</span>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full mt-2 inline-block">PROGRESS</span>
            </div>
          </div>
          
          <div className="flex w-full gap-4 mt-auto">
            <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col items-start justify-between h-24">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="flex justify-between w-full items-end">
                <span className="text-xs font-bold text-gray-500 w-1/2">CHALLENGES SOLVED</span>
                <span className="text-xl font-bold text-gray-900">0/0</span>
              </div>
            </div>
            
            <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col items-start justify-between h-24">
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <div className="flex justify-between w-full items-end">
                <span className="text-xs font-bold text-gray-500 w-1/2">SOLVE ACCURACY</span>
                <span className="text-xl font-bold text-gray-900">33%</span>
              </div>
            </div>
          </div>
          
          <button className="w-full mt-4 py-3 border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-50 transition">
            View Progress &gt;
          </button>
        </div>

        {/* Track Nodes Card */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-16">
            <h2 className="text-lg font-bold text-gray-900">Event Track</h2>
            <div className="flex gap-4 text-xs font-bold">
              <span className="flex items-center gap-1 text-green-600"><span className="w-3 h-3 rounded-full border-2 border-green-600"></span> COMPLETED</span>
              <span className="flex items-center gap-1 text-indigo-600"><span className="w-3 h-3 rounded-full border-2 border-indigo-600"></span> ACTIVE</span>
              <span className="flex items-center gap-1 text-gray-400"><span className="w-3 h-3 rounded-full border-2 border-gray-400"></span> LOCKED</span>
            </div>
          </div>
          
          {/* Node Graph Mockup */}
          <div className="relative flex justify-between items-start pt-8 pb-32">
            <div className="absolute top-12 left-10 right-10 h-0.5 bg-green-200 z-0"></div>
            
            {['Track 1 (Web)', 'Track 2 (OSINT)', 'Track 3 (Forensics)', 'Track 4 (Crypto...)'].map((track, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-green-200 shadow-sm flex items-center justify-center p-1 relative">
                  <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                    <span className="text-white text-xs">IMG</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-white">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-gray-900">{track}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1">COMPLETED</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
