const entityColumnNameCsvHeaderMap = {
  Name: 'name',
  Code: 'code',
};

const uploadDataRows = [
  { Name: 'Lagos State', Code: 'LAG' },
  { Name: 'Delta State', Code: 'DEL' },
  { Name: 'Kano State', Code: 'KNO' },
  { Name: 'Kaduna State', Code: 'KDA' },
  { Name: 'Rivers State', Code: 'RVR' },
  { Name: 'Federal Capital Territory', Code: 'FCT' },
];

const statesDuplicateKey = 'name';

export { entityColumnNameCsvHeaderMap, uploadDataRows, statesDuplicateKey };
