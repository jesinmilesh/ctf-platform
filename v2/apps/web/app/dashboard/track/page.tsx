'use client';

import { useState } from 'react';

export default function TrackPage() {
  const [activeTrack, setActiveTrack] = useState(1);
  
  const tracks = [
    { id: 1, name: 'Track 1 (Web)' },
    { id: 2, name: 'Track 2 (OSINT)' },
    { id: 3, name: 'Track 3 (Forensics)' },
    { id: 4, name: 'Track 4 (Crypto / St...)' },
    { id: 5, name: 'Track 5 (Reverse En...)' },
  ];

  return (
    <div className="flex flex-col gap-10 mt-4">
      {/* Event Track Graph */}
      <div className="w-full">
        <h2 className="text-md font-bold text-gray-900 mb-10">Event Track</h2>
        
        <div className="relative flex justify-between items-start w-full px-8">
          {/* Connecting Line */}
          <div className="absolute top-8 left-16 right-16 h-px bg-indigo-100 z-0"></div>
          
          {tracks.map((track) => {
            const isActive = activeTrack === track.id;
            return (
              <div 
                key={track.id} 
                className="relative z-10 flex flex-col items-center gap-3 cursor-pointer group"
                onClick={() => setActiveTrack(track.id)}
              >
                <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center p-1 relative transition-all duration-200 ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2' : 'hover:ring-2 hover:ring-indigo-200 hover:ring-offset-2'}`}>
                  {/* The actual image bubble */}
                  <div className="w-full h-full rounded-full bg-slate-900 border border-gray-200 overflow-hidden flex items-center justify-center bg-[url('https://api.dicebear.com/7.x/shapes/svg?seed=shield&backgroundColor=0f172a')] bg-cover bg-center">
                    {/* Placeholder shield image since we don't have the real asset */}
                  </div>
                  
                  {/* Green checkmark badge */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-white z-20">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  
                  {/* Red dot indicator for active track */}
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white z-20"></div>
                  )}
                </div>
                
                <div className="text-center mt-1">
                  <p className="font-bold text-[13px] text-gray-900">{track.name}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">COMPLETED</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full h-px bg-indigo-50 my-2"></div>

      {/* Selected Track Details Area */}
      <div className="flex flex-col gap-6">
        {/* Banner */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex justify-between items-center shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
          
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-gray-900 mb-1">{tracks.find(t => t.id === activeTrack)?.name.replace('...', 'ngineering')}</h2>
            <p className="text-sm text-gray-500">Complete the available challenge path for this track.</p>
          </div>
          
          <div className="flex items-center gap-8 relative z-10">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Challenges Solved</span>
              <span className="text-lg font-bold text-gray-900 font-mono tracking-widest">0 / 0</span>
            </div>
            
            <div className="h-10 w-px bg-gray-200"></div>
            
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Track Ended</span>
                <span className="font-mono text-gray-900 font-bold tracking-widest">00:00:00</span>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-gray-700" 
              placeholder="Search challenges by name or category..."
            />
          </div>
          
          <div className="flex gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              </div>
              <select className="appearance-none pl-9 pr-10 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option>All Categories</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              </div>
              <select className="appearance-none pl-9 pr-10 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option>Any</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20 text-gray-900 mt-4">
          <svg className="w-12 h-12 text-gray-400 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <p className="text-[15px] font-bold">Challenges are being prepared</p>
        </div>
      </div>
    </div>
  );
}
