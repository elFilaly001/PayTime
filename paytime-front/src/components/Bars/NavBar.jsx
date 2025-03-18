import React from 'react';
import { Bell, Search } from 'lucide-react';

export default function NavBar(){
  return (
    <nav className="w-full bg-white border-b border-gray-200 px-4 py-2 h-[60px]">
      <div className="flex items-center justify-evenly h-full ml-[265px]">
        {/* Logo for mobile, visible only on smaller screens */}
        <div className="md:hidden text-indigo-500 text-2xl font-bold">
          <svg 
            viewBox="0 0 24 24" 
            className="w-8 h-8"
            fill="currentColor"
          >
            <path d="M12 4C6.48 4 2 8.48 2 14s4.48 10 10 10h10V14c0-5.52-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
        </div>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-4 ">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Side Items */}
        <div className="flex items-center space-x-4">
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
} 