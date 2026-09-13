export default function TeamPage() {
  const members = [
    { email: 'jeshu1161@gmail.com', contribs: 1, points: 750, hintCost: 0, penalty: 0, total: 750, attempts: 3, accuracy: '33%', lastActivity: 'Sep 9, 2026, 5:56 PM' },
    { email: 'ashishmails06@gmail.com', contribs: 0, points: 0, hintCost: 0, penalty: 0, total: 0, attempts: 0, accuracy: '0%', lastActivity: 'No activity' },
    { email: 'jesinmilesh61@gmail.com', contribs: 0, points: 0, hintCost: 0, penalty: 0, total: 0, attempts: 0, accuracy: '0%', lastActivity: 'No activity' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="bg-indigo-50/50 rounded-xl shadow-sm border border-indigo-50 p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
        </div>
        <div className="bg-white px-4 py-2 rounded-full border text-sm font-bold text-gray-600 shadow-sm">
          3 Members
        </div>
      </div>

      {/* Team Info Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Your Event Team</p>
            <h2 className="text-xl font-black text-gray-900">10241CyberPunishers</h2>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              3 members
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Choose new logo
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex gap-4 items-center mb-2">
            <div className="w-8 h-8 rounded bg-gray-50 border flex items-center justify-center text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Team Score</span>
          </div>
          <span className="text-3xl font-black text-gray-900 ml-12">750</span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex gap-4 items-center mb-2">
            <div className="w-8 h-8 rounded bg-green-50 border border-green-100 flex items-center justify-center text-green-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Challenges Solved</span>
          </div>
          <span className="text-3xl font-black text-gray-900 ml-12">1</span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex gap-4 items-center mb-2">
            <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Challenge Points</span>
          </div>
          <span className="text-3xl font-black text-gray-900 ml-12">750</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-indigo-50/30 text-xs font-bold text-gray-700 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4 text-center">Challenges Contributed</th>
                <th className="px-6 py-4 text-center">Contribution Points</th>
                <th className="px-6 py-4 text-center">Hint Cost</th>
                <th className="px-6 py-4 text-center">Award/Penalty</th>
                <th className="px-6 py-4 text-center">Total Points</th>
                <th className="px-6 py-4 text-center">Attempts</th>
                <th className="px-6 py-4 text-center">Accuracy</th>
                <th className="px-6 py-4">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-bold text-gray-900">{m.email}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.contribs}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.points}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.hintCost}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.penalty}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.total}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.attempts}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-700">{m.accuracy}</td>
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{m.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
