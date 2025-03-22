export default function ButtonRedirect({ text, href }) {
    return (
        <a href={href} className="bg-gray-500 text-white p-2 rounded-md">{text}</a>
    )
}