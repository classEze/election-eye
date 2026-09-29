const entityColumnNameCsvHeaderMap = {
  Name: 'name',
  'Ward Code': 'wardCode',
};

const uploadDataRows = [
  { Name: 'Obiokpor', 'Ward Code': 'OBK' },
  { Name: 'Ijanikin', 'Ward Code': 'IJK' },
  { Name: 'Iwelumi', 'Ward Code': 'IWM' },
];

const genericUploadDataRows = [
  { 'Lga Id': 1, Name: 'Obiokpor', 'Ward Code': 'OBK' },
  { 'Lga Id': 1, Name: 'Ijanikin', 'Ward Code': 'IJK' },
  { 'Lga Id': 2, Name: 'Iwelumi', 'Ward Code': 'IWM' },
];

const wardsDuplicateKey = 'name';

export {
  entityColumnNameCsvHeaderMap,
  uploadDataRows,
  genericUploadDataRows,
  wardsDuplicateKey,
};
