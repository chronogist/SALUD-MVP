program salud_records.aleo;

record MedicalRecord:
    owner as address.private;
    record_id as field.private;
    data_hash as field.private;
    data_part1 as field.private;
    data_part2 as field.private;
    data_part3 as field.private;
    data_part4 as field.private;
    data_part5 as field.private;
    data_part6 as field.private;
    data_part7 as field.private;
    data_part8 as field.private;
    record_type as u8.private;
    created_at as u32.private;
    version as u8.private;

record SharedMedicalRecord:
    owner as address.private;
    record_id as field.private;
    original_owner as address.private;
    data_hash as field.private;
    data_part1 as field.private;
    data_part2 as field.private;
    data_part3 as field.private;
    data_part4 as field.private;
    data_part5 as field.private;
    data_part6 as field.private;
    data_part7 as field.private;
    data_part8 as field.private;
    record_type as u8.private;
    duration_blocks as u32.private;
    access_token as field.private;

struct AccessGrant:
    patient as address;
    doctor as address;
    record_id as field;
    access_token as field;
    granted_at as u32;
    expires_at as u32;
    is_revoked as boolean;

struct RecordMetadata:
    patient as address;
    record_id as field;
    record_type as u8;
    created_at as u32;
    is_active as boolean;

struct RecordIdInput:
    patient as address;
    data_hash as field;
    nonce as field;

struct AccessTokenInput:
    record_id as field;
    doctor as address;
    patient as address;
    nonce as field;

mapping access_grants:
    key as field.public;
    value as AccessGrant.public;

mapping record_metadata:
    key as field.public;
    value as RecordMetadata.public;

mapping patient_record_count:
    key as field.public;
    value as u64.public;

mapping access_token_valid:
    key as field.public;
    value as boolean.public;

function create_record:
    input r0 as field.private;
    input r1 as field.private;
    input r2 as field.private;
    input r3 as field.private;
    input r4 as field.private;
    input r5 as field.private;
    input r6 as field.private;
    input r7 as field.private;
    input r8 as u8.private;
    input r9 as field.private;
    input r10 as field.private;
    input r11 as boolean.private;
    gte r8 1u8 into r12;
    lte r8 10u8 into r13;
    and r12 r13 into r14;
    assert.eq r14 true;
    cast self.caller r9 r10 into r15 as RecordIdInput;
    hash.bhp256 r15 into r16 as field;
    cast self.caller r16 r9 r0 r1 r2 r3 r4 r5 r6 r7 r8 0u32 1u8 into r17 as MedicalRecord.record;
    async create_record self.caller r16 r8 r11 into r18;
    output r17 as MedicalRecord.record;
    output r18 as salud_records.aleo/create_record.future;

finalize create_record:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as u8.public;
    input r3 as boolean.public;
    cast r0 into r4 as field;
    get.or_use patient_record_count[r4] 0u64 into r5;
    add r5 1u64 into r6;
    set r6 into patient_record_count[r4];
    branch.eq r3 false to end_then_0_0;
    cast r0 r1 r2 block.height true into r7 as RecordMetadata;
    set r7 into record_metadata[r1];
    branch.eq true true to end_otherwise_0_1;
    position end_then_0_0;
    position end_otherwise_0_1;

function share_record:
    input r0 as MedicalRecord.record;
    input r1 as address.private;
    input r2 as u32.private;
    input r3 as field.private;
    assert.neq self.caller r1;
    lt r2 240u32 into r4;
    ternary r4 240u32 r2 into r5;
    gt r5 40320u32 into r6;
    ternary r6 40320u32 r5 into r7;
    cast r0.record_id r1 self.caller r3 into r8 as AccessTokenInput;
    hash.bhp256 r8 into r9 as field;
    cast self.caller r0.record_id r0.data_hash r0.data_part1 r0.data_part2 r0.data_part3 r0.data_part4 r0.data_part5 r0.data_part6 r0.data_part7 r0.data_part8 r0.record_type r0.created_at r0.version into r10 as MedicalRecord.record;
    cast r1 r0.record_id self.caller r0.data_hash r0.data_part1 r0.data_part2 r0.data_part3 r0.data_part4 r0.data_part5 r0.data_part6 r0.data_part7 r0.data_part8 r0.record_type r7 r9 into r11 as SharedMedicalRecord.record;
    async share_record self.caller r1 r0.record_id r9 r7 into r12;
    output r10 as MedicalRecord.record;
    output r11 as SharedMedicalRecord.record;
    output r9 as field.private;
    output r12 as salud_records.aleo/share_record.future;

finalize share_record:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as field.public;
    input r4 as u32.public;
    add block.height r4 into r5;
    cast r0 r1 r2 r3 block.height r5 false into r6 as AccessGrant;
    set r6 into access_grants[r3];
    set true into access_token_valid[r3];

function revoke_access:
    input r0 as field.private;
    async revoke_access self.caller r0 into r1;
    output r1 as salud_records.aleo/revoke_access.future;

finalize revoke_access:
    input r0 as address.public;
    input r1 as field.public;
    get access_grants[r1] into r2;
    assert.eq r2.patient r0;
    cast r2.patient r2.doctor r2.record_id r2.access_token r2.granted_at r2.expires_at true into r3 as AccessGrant;
    set r3 into access_grants[r1];
    set false into access_token_valid[r1];

constructor:
    assert.eq program_owner aleo1gl4a57rcxyjvmzcgjscjqe466ecdr7uk4gdp7sf5pctu6tjvv5qs60lw8y;
