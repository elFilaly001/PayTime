import NavBar from "../components/Bars/NavBar"
import SideBar from "../components/Bars/Sidebar"

export default function HomePage() {
    return (
        <div className="flex flex-col min-h-screen">
            <NavBar />
            <div className="flex flex-1">
                <SideBar />

                {/* Main Content */}
                <main className="flex-1 p-6 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-gray-900 mb-6">Home</h1>

                        {/* Example content */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-semibold mb-4">Welcome to your dashboard</h2>
                            <p className="text-gray-600">
                                This is where you'll find all your important information and quick access to projects.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}