import { forwardRef } from "react";

const InputOTP = forwardRef(({ className, onChange, onFocus, onKeyDown }, ref) => {
    return (
        <input
            ref={ref}
            type="text"
            maxLength={1}
            className={`w-12 h-12 border-2 rounded-lg text-2xl ${className}`}
            onChange={onChange}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
        />
    );
});

export default InputOTP;