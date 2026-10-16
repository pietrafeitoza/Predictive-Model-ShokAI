export const fullNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  notation: 'compact',
});

export const formatFullNumber = (value: number) => fullNumberFormatter.format(value);
export const formatCompactNumber = (value: number) => compactNumberFormatter.format(value);

export const formatPredictionRecords = (value: number) =>
  `${formatFullNumber(value)} prediction ${value === 1 ? 'record' : 'records'}`;
