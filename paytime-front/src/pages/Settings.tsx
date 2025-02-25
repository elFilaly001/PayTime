import React from 'react'
import NavBar from '../components/Bars/NavBar';
import SideBar from '../components/Bars/Sidebar';
import Payments from '../components/Cards/Payments';
export default function Settings() {
    return (
        <div className="flex flex-col min-h-screen">
            <NavBar />
            <div className="flex flex-1">
                <SideBar />

                {/* Main Content */}
                <main className="flex-1 p-6 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
                        <Payments/>
                    </div>
                </main>
            </div>
        </div>
    );
}