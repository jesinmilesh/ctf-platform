export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="bg-indigo-50/50 rounded-xl shadow-sm border border-indigo-50 p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Progress</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Score</p>
            <p className="text-3xl font-black text-gray-900">0</p>
          </div>
          <div className="w-10 h-10 rounded bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Challenges Solved</p>
            <p className="text-3xl font-black text-gray-900">0</p>
          </div>
          <div className="w-10 h-10 rounded bg-green-50 border border-green-100 flex items-center justify-center text-green-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Success Rate</p>
            <p className="text-3xl font-black text-gray-900">0%</p>
          </div>
          <div className="w-10 h-10 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Track filter</p>
            <p className="text-xs text-gray-500">View progress for this event track</p>
          </div>
        </div>
        <div className="relative">
          <select className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-lg shadow-sm font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]">
            <option>All Tracks</option>
            <option>Track 1 (Web)</option>
            <option>Track 2 (OSINT)</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-64">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Correct Vs Incorrect Submissions</h3>
          <div className="flex-grow flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50/50">
            <p className="text-sm font-bold text-gray-400">No submission data available.</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Challenges Vs Total Hint Cost</h3>
          <div className="flex-grow flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50/50">
            <p className="text-sm font-bold text-gray-400">No hint cost data available.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Submissions Over Time</h3>
          <div className="flex-grow flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50/50">
            <p className="text-sm font-bold text-gray-400">No submissions recorded over time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
