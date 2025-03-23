export default function InputUsername({ placeholder, value, onChange , name }) {
    return (
        <>
            <input 
                className="outline-none border-2 w-1/2 rounded-md p-1 pl-3 text-md  border-indigo-600" 
                type="text" 
                placeholder={placeholder} 
                value={value} 
                onChange={onChange} 
                name={name}
            />
        </>
    )
}