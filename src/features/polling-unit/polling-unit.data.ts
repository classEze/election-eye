const entityColumnNameCsvHeaderMap = {
  Name: 'name',
  'Unit Code': 'puCode',
};

const uploadDataRows = [
  { Name: 'Okwele Primary School', 'Unit Code': 'OKW' },
  { Name: 'Egbeda Secondary School', 'Unit Code': 'IJEGBK' },
  { Name: 'Sagamu Express', 'Unit Code': 'SAG' },
];

const genericUploadDataRows = [
  { 'Ward Id': 1, Name: 'Okwele Primary School', 'Unit Code': 'OKW' },
  { 'Ward Id': 1, Name: 'Egbeda Secondary School', 'Unit Code': 'IJEGBK' },
  { 'Ward Id': 2, Name: 'Sagamu Express', 'Unit Code': 'SAG' },
];

const pollingUnitDuplicateKey = 'name';

export {
  entityColumnNameCsvHeaderMap,
  uploadDataRows,
  genericUploadDataRows,
  pollingUnitDuplicateKey,
};
