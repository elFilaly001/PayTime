import React from 'react';
import Select from 'react-select';
import countryList from 'react-select-country-list';

const groupStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

// const groupBadgeStyles = {
//   backgroundColor: '#EBECF0',
//   borderRadius: '2em',
//   color: '#172B4D',
//   display: 'inline-block',
//   fontSize: 12,
//   fontWeight: 'normal',
//   lineHeight: '1',
//   minWidth: 1,
//   padding: '0.16666666666667em 0.5em',
//   textAlign: 'center',
// };

const formatGroupLabel = (data) => (
  <div style={groupStyles}>
    <span>{data.label}</span>
    <span style={groupBadgeStyles}>{data.options.length}</span>
  </div>
);

const options = countryList().getData();

export default function CountrySelect({ value, onChange }) {
  return (
    <Select
      className="outline-none border-2 w-1/2 rounded-md text-md border-gray-500 focus:border-blue-500"
      value={value}
      onChange={onChange}
      options={options}
      formatGroupLabel={formatGroupLabel}
    />
  );
}