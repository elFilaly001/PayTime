import { useState } from 'react';
export default function InputPassword({ placeholder, value, onChange, name }) {

    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };
    return (
        <>
            <div className="flex flex-row w-1/2 m-0">
                <input
                    className="outline-none w-full border-2 rounded-l-md p-1 pl-3 text-md  border-indigo-600"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={placeholder}
                    name={name}
                    value={value}
                    onChange={onChange}
                />
                <button 
                    type="button" 
                    className="bg-indigo-600 text-white p-1 rounded-r-md" 
                    onClick={togglePasswordVisibility}
                >
                    {showPassword ? 'Hide' : 'Show'}
                </button>
            </div>
        </>
    )
}