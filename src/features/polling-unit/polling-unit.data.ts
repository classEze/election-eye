const entityColumnNameCsvHeaderMap = {
  Name: 'name',
  'Unit Code': 'puCode',
};

const uploadDataRows = [
  { Name: 'Okwele Primary School', 'Unit Code': 'OKW' },
  { Name: 'Egbeda Secondary School', 'Unit Code': 'IJEGBK' },
  { Name: 'Sagamu Express', 'Unit Code': 'SAG' },
];

const pollingUnitDuplicateKey = 'name';

export {
  entityColumnNameCsvHeaderMap,
  uploadDataRows,
  pollingUnitDuplicateKey,
};
