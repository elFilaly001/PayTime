import React from 'react';
import { Home, Users, FolderIcon, Calendar, FileText, PieChart, Settings } from 'lucide-react';
import { Tag, FileClock } from "lucide-react"
import { NavLink } from 'react-router-dom';


export default function SideBar() {
  return (
    <div className="bg-indigo-600 text-white w-64  flex flex-col">
      {/* Main Navigation */}
      <nav className="flex-1">
        <ul className="flex-col justify-between space-y-1 px-3 pt-4">
          <li>
            <NavLink
              to="/"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-indigo-700"
              activeClassName="bg-indigo-700"
            >
              <Tag className="w-5 h-5" />
              <span className="font-medium">Tickets</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/friend-list"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-indigo-700"
              activeClassName="bg-indigo-700"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Friend List</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/history"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-indigo-700"
              activeClassName="bg-indigo-700"
            >
              <FileClock />
              <span className="font-medium">History</span>
            </NavLink>
          </li>
        </ul>
      </nav>



      {/* Settings */}
      <div className="p-6 mt-auto">
        <NavLink
          to="/settings"
          className="flex items-center space-x-3 hover:text-indigo-200 hover:bg-indigo-700 p-3 rounded-lg"
          activeClassName="text-indigo-200"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </NavLink>
      </div>
    </div>
  );
}