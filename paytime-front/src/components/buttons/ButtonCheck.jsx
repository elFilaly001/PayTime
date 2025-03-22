import { Check } from "lucide-react";

export default function ButtonCheck({onClick}) {
    return (
        <>
            <button className="w-8 h-8 bg-green-500 hover:bg-green-700 text-white font-medium rounded-md text-sm flex items-center justify-center mr-3"
                onClick={onClick} >
                <Check />
            </button>
        </>
    )
}