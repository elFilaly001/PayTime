

export default function InputEmail({ placeholder, value, name, onChange = () => {} }) {

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const handleChange = (e) => {
        const newValue = e.target.value;
        onChange(e);

        // Check if the new value matches the regex
        if (newValue.length > 0) {
            if (emailRegex.test(newValue)) {
                e.target.style.borderColor = 'green'; 
            } else {
                e.target.style.borderColor = 'red';
            }
        } else {
            e.target.style.borderColor = 'gray';
        }
    };

    return (
        <>
            <input 
                className="outline-none border-2 w-1/2 rounded-md p-1 pl-3 text-md border-gray-500" 
                type="email" 
                placeholder={placeholder} 
                value={value} 
                onChange={handleChange} 
                name={name}
            />
        </>
    )
}

