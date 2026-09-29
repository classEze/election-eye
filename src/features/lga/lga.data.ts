const entityColumnNameCsvHeaderMap = {
  Name: 'name',
  'LGA CODE': 'lgaCode',
};

const uploadDataRows = [
  { Name: 'Ndokwa West', 'LGA Code': 'NWE' },
  { Name: 'Ethiope South', 'LGA Code': 'ETH' },
];

const genericUploadDataRows = [
  { 'State Id': 1, Name: 'Ndokwa West', 'LGA Code': 'NWE' },
  { 'State Id': 1, Name: 'Ethiope South', 'LGA Code': 'ETH' },
];

const lgaDuplicateKey = 'name';

export {
  entityColumnNameCsvHeaderMap,
  uploadDataRows,
  genericUploadDataRows,
  lgaDuplicateKey,
};
