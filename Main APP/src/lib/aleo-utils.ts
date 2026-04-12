/**
 * Aleo Utility Functions
 *
 * Helper functions to encode/decode data for Aleo blockchain transactions
 */

import type { RecordType } from '@/types/records';

export const PROGRAM_ID = 'salud_records.aleo';

const NUM_FIELD_PARTS = 8;
const BYTES_PER_FIELD = 30;

/**
 * Convert a string to bytes and then to field elements
 * Using 12 fields to get ~360 bytes capacity
 */
export function stringToFieldElements(data: string): string[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  
  const fields: string[] = [];
  
  for (let i = 0; i < NUM_FIELD_PARTS; i++) {
    const start = i * BYTES_PER_FIELD;
    const end = Math.min(start + BYTES_PER_FIELD, bytes.length);
    const part = bytes.slice(start, end);
    fields.push(bytesToField(part));
  }
  
  // Pad remaining fields with zeros
  while (fields.length < NUM_FIELD_PARTS) {
    fields.push('0field');
  }
  
  return fields;
}

/**
 * Convert bytes to a field element (as a decimal string + 'field')
 */
function bytesToField(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '0field';
  }
  
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }
  
  return `${value.toString()}field`;
}

/**
 * Convert field elements back to string
 */
export function fieldElementsToString(fields: string[]): string {
  const allBytes: number[] = [];

  for (const fieldStr of fields) {
    const bytes = fieldToBytes(fieldStr);
    allBytes.push(...bytes);
  }

  // Strip trailing null bytes from the 8x30-byte field padding,
  // otherwise JSON.parse on the result fails.
  let end = allBytes.length;
  while (end > 0 && allBytes[end - 1] === 0) end--;

  return new TextDecoder().decode(new Uint8Array(allBytes.slice(0, end)));
}

/**
 * Convert a field element string to bytes
 */
function fieldToBytes(fieldStr: string): Uint8Array {
  const valueStr = fieldStr.replace('field', '');
  
  if (valueStr === '0' || valueStr === '') {
    return new Uint8Array(0);
  }
  
  let value = BigInt(valueStr);
  const bytes: number[] = [];
  
  while (value > 0) {
    bytes.unshift(Number(value & BigInt(0xff)));
    value = value >> BigInt(8);
  }
  
  return new Uint8Array(bytes);
}

/**
 * Hash data using a simple hash function (for data_hash)
 */
export function hashData(data: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  
  let hash = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    hash = hash + BigInt(bytes[i]) * BigInt(i + 1);
  }
  
  hash = hash * BigInt(31) + BigInt(17);
  
  return `${hash.toString()}field`;
}

/**
 * Generate a random nonce for unique ID generation
 */
export function generateNonce(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  
  let nonce = BigInt(0);
  for (let i = 0; i < randomBytes.length; i++) {
    nonce = (nonce << BigInt(8)) | BigInt(randomBytes[i]);
  }
  
  return `${nonce.toString()}field`;
}

/**
 * Create the data string from title and description
 */
export function createRecordData(title: string, description: string): string {
  const data = {
    t: title,
    d: description,
  };
  
  return JSON.stringify(data);
}

/**
 * Format record type for Aleo transaction
 */
export function formatRecordType(recordType: RecordType): string {
  return `${recordType}u8`;
}

/**
 * Format boolean for Aleo transaction
 */
export function formatBoolean(value: boolean): string {
  return value ? 'true' : 'false';
}

/**
 * Prepare inputs for create_record transaction
 */
export interface CreateRecordInputs {
  data_part1: string;
  data_part2: string;
  data_part3: string;
  data_part4: string;
  data_part5: string;
  data_part6: string;
  data_part7: string;
  data_part8: string;
  record_type: string;
  data_hash: string;
  nonce: string;
  make_discoverable: string;
}

export function prepareCreateRecordInputs(
  title: string,
  description: string,
  recordType: RecordType,
  makeDiscoverable: boolean = true
): CreateRecordInputs {
  const dataStr = createRecordData(title, description);
  const parts = stringToFieldElements(dataStr);
  const dataHash = hashData(dataStr);
  const nonce = generateNonce();

  return {
    data_part1: parts[0],
    data_part2: parts[1],
    data_part3: parts[2],
    data_part4: parts[3],
    data_part5: parts[4],
    data_part6: parts[5],
    data_part7: parts[6],
    data_part8: parts[7],
    record_type: formatRecordType(recordType),
    data_hash: dataHash,
    nonce: nonce,
    make_discoverable: formatBoolean(makeDiscoverable),
  };
}

/**
 * Convert inputs to array format for executeTransaction
 * Must match create_record transition signature: 8 data parts + record_type + data_hash + nonce + make_discoverable
 */
export function inputsToArray(inputs: CreateRecordInputs): string[] {
  return [
    inputs.data_part1,
    inputs.data_part2,
    inputs.data_part3,
    inputs.data_part4,
    inputs.data_part5,
    inputs.data_part6,
    inputs.data_part7,
    inputs.data_part8,
    inputs.record_type,
    inputs.data_hash,
    inputs.nonce,
    inputs.make_discoverable,
  ];
}

/**
 * Prepare inputs for share_record transaction.
 *
 * share_record takes: (MedicalRecord, address, u32, field)
 * The MedicalRecord is passed as the raw record plaintext string.
 */
export function prepareShareRecordInputs(
  recordPlaintext: string,
  doctorAddress: string,
  durationBlocks: number
): string[] {
  const nonce = generateNonce();
  return [
    recordPlaintext,
    doctorAddress,
    `${durationBlocks}u32`,
    nonce,
  ];
}

/**
 * Prepare inputs for revoke_access transaction.
 * revoke_access takes: (field)
 */
export function prepareRevokeAccessInputs(accessToken: string): string[] {
  return [accessToken.endsWith('field') ? accessToken : `${accessToken}field`];
}

/**
 * Robustly extract `title` and `description` from a record's data string.
 *
 * The data is stored as JSON like `{"t":"...","d":"..."}` but can come back
 * malformed for two reasons:
 *  - the 240-byte field cap may truncate long descriptions
 *  - the BigInt round-trip in fieldToBytes drops leading zero bytes inside
 *    a chunk, which can corrupt the trailing bytes of the payload
 *
 * So we try strict JSON.parse first, then fall back to a regex extractor
 * that walks the string character-by-character and survives missing
 * closing quotes / braces.
 */
export function extractTitleAndDescription(data: string): { title: string; description: string } {
  if (!data || data === '0') return { title: '', description: '' };

  try {
    const j = JSON.parse(data);
    return {
      title: String(j.title ?? j.t ?? ''),
      description: String(j.description ?? j.d ?? ''),
    };
  } catch {
    // fall through to regex extraction
  }

  return {
    title: extractJsonStringField(data, 't') || extractJsonStringField(data, 'title'),
    description: extractJsonStringField(data, 'd') || extractJsonStringField(data, 'description'),
  };
}

function extractJsonStringField(s: string, key: string): string {
  const re = new RegExp(`"${key}"\\s*:\\s*"`);
  const m = s.match(re);
  if (!m || m.index === undefined) return '';
  let i = m.index + m[0].length;
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === '"') out += '"';
      else if (n === '\\') out += '\\';
      else if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === '/') out += '/';
      else out += n;
      i += 2;
    } else if (c === '"') {
      break;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Parse a SharedMedicalRecord plaintext from the wallet.
 * Similar to parseRecordPlaintext in useSyncRecords but for shared records.
 */
export function parseSharedRecordPlaintext(plaintextStr: string): {
  recordId: string;
  originalOwner: string;
  dataHash: string;
  data: string;
  recordType: number;
  durationBlocks: number;
  accessToken: string;
} | null {
  try {
    const extractValue = (key: string): string => {
      const regex = new RegExp(`${key}:\\s*([^,\\n}]+)`);
      const match = plaintextStr.match(regex);
      return match ? match[1].trim() : '';
    };

    const clean = (val: string) =>
      val
        .replace(/\.private$/, '')
        .replace(/\.public$/, '')
        .replace(/u64$/, '')
        .replace(/u32$/, '')
        .replace(/u16$/, '')
        .replace(/u8$/, '')
        .replace(/field$/, '')
        .replace(/group$/, '')
        .replace(/scalar$/, '');

    const recordId = clean(extractValue('record_id'));
    const originalOwner = extractValue('original_owner').replace(/\.private$/, '').replace(/\.public$/, '');
    const dataHash = clean(extractValue('data_hash'));
    const recordType = parseInt(clean(extractValue('record_type')) || '10', 10);
    const durationBlocks = parseInt(clean(extractValue('duration_blocks')) || '0', 10);
    const accessToken = clean(extractValue('access_token'));

    const dataParts: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const val = clean(extractValue(`data_part${i}`));
      dataParts.push(`${val || '0'}field`);
    }

    const data = fieldElementsToString(dataParts);

    return { recordId, originalOwner, dataHash, data, recordType, durationBlocks, accessToken };
  } catch (error) {
    console.error('Error parsing shared record:', error);
    return null;
  }
}
