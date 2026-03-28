// Salud Health Records - Privacy-Preserving Medical Records on Aleo

struct AccessGrant {
    patient: address,
    doctor: address,
    record_id: field,
    access_token: field,
    granted_at: u32,
    expires_at: u32,
    is_revoked: bool,
}

struct RecordMetadata {
    patient: address,
    record_id: field,
    record_type: u8,
    created_at: u32,
    is_active: bool,
}

struct RecordIdInput {
    patient: address,
    data_hash: field,
    nonce: field,
}

struct AccessTokenInput {
    record_id: field,
    doctor: address,
    patient: address,
    nonce: field,
}

final fn finalize_create_record(
    patient: address,
    record_id: field,
    record_type: u8,
    make_discoverable: bool
) {
    let patient_key: field = patient as field;
    let current_count: u64 = Mapping::get_or_use(patient_record_count, patient_key, 0u64);
    Mapping::set(patient_record_count, patient_key, current_count + 1u64);

    if make_discoverable {
        Mapping::set(record_metadata, record_id, RecordMetadata {
            patient: patient,
            record_id: record_id,
            record_type: record_type,
            created_at: block.height,
            is_active: true,
        });
    }
}

final fn finalize_share_record(
    patient: address,
    doctor: address,
    record_id: field,
    access_token: field,
    duration_blocks: u32
) {
    let expires_at: u32 = block.height + duration_blocks;

    Mapping::set(access_grants, access_token, AccessGrant {
        patient: patient,
        doctor: doctor,
        record_id: record_id,
        access_token: access_token,
        granted_at: block.height,
        expires_at: expires_at,
        is_revoked: false,
    });
    Mapping::set(access_token_valid, access_token, true);
}

final fn finalize_revoke_access(
    caller: address,
    access_token: field
) {
    let grant: AccessGrant = Mapping::get(access_grants, access_token);
    assert_eq(grant.patient, caller);

    Mapping::set(access_grants, access_token, AccessGrant {
        patient: grant.patient,
        doctor: grant.doctor,
        record_id: grant.record_id,
        access_token: grant.access_token,
        granted_at: grant.granted_at,
        expires_at: grant.expires_at,
        is_revoked: true,
    });
    Mapping::set(access_token_valid, access_token, false);
}

program salud_records.aleo {

    @admin(address = "aleo1gl4a57rcxyjvmzcgjscjqe466ecdr7uk4gdp7sf5pctu6tjvv5qs60lw8y")
    constructor() {}

    const MAX_ACCESS_DURATION_BLOCKS: u32 = 40320u32;
    const MIN_ACCESS_DURATION_BLOCKS: u32 = 240u32;

    record MedicalRecord {
        owner: address,
        record_id: field,
        data_hash: field,
        data_part1: field,
        data_part2: field,
        data_part3: field,
        data_part4: field,
        data_part5: field,
        data_part6: field,
        data_part7: field,
        data_part8: field,
        record_type: u8,
        created_at: u32,
        version: u8,
    }

    record SharedMedicalRecord {
        owner: address,
        record_id: field,
        original_owner: address,
        data_hash: field,
        data_part1: field,
        data_part2: field,
        data_part3: field,
        data_part4: field,
        data_part5: field,
        data_part6: field,
        data_part7: field,
        data_part8: field,
        record_type: u8,
        duration_blocks: u32,
        access_token: field,
    }

    mapping access_grants: field => AccessGrant;
    mapping record_metadata: field => RecordMetadata;
    mapping patient_record_count: field => u64;
    mapping access_token_valid: field => bool;

    fn create_record(
        data_part1: field,
        data_part2: field,
        data_part3: field,
        data_part4: field,
        data_part5: field,
        data_part6: field,
        data_part7: field,
        data_part8: field,
        record_type: u8,
        data_hash: field,
        nonce: field,
        make_discoverable: bool
    ) -> (MedicalRecord, Final) {
        assert(record_type >= 1u8 && record_type <= 10u8);

        let record_id: field = BHP256::hash_to_field(RecordIdInput {
            patient: self.caller,
            data_hash: data_hash,
            nonce: nonce,
        });

        let medical_record: MedicalRecord = MedicalRecord {
            owner: self.caller,
            record_id: record_id,
            data_hash: data_hash,
            data_part1: data_part1,
            data_part2: data_part2,
            data_part3: data_part3,
            data_part4: data_part4,
            data_part5: data_part5,
            data_part6: data_part6,
            data_part7: data_part7,
            data_part8: data_part8,
            record_type: record_type,
            created_at: 0u32,
            version: 1u8,
        };

        let caller: address = self.caller;
        return (medical_record, final {
            finalize_create_record(caller, record_id, record_type, make_discoverable);
        });
    }

    fn share_record(
        medical_record: MedicalRecord,
        doctor: address,
        duration_blocks: u32,
        nonce: field
    ) -> (MedicalRecord, SharedMedicalRecord, field, Final) {
        assert_neq(self.caller, doctor);

        let clamped_min: u32 = duration_blocks < MIN_ACCESS_DURATION_BLOCKS ? MIN_ACCESS_DURATION_BLOCKS : duration_blocks;
        let safe_duration: u32 = clamped_min > MAX_ACCESS_DURATION_BLOCKS ? MAX_ACCESS_DURATION_BLOCKS : clamped_min;

        let access_token: field = BHP256::hash_to_field(AccessTokenInput {
            record_id: medical_record.record_id,
            doctor: doctor,
            patient: self.caller,
            nonce: nonce,
        });

        let patient_record: MedicalRecord = MedicalRecord {
            owner: self.caller,
            record_id: medical_record.record_id,
            data_hash: medical_record.data_hash,
            data_part1: medical_record.data_part1,
            data_part2: medical_record.data_part2,
            data_part3: medical_record.data_part3,
            data_part4: medical_record.data_part4,
            data_part5: medical_record.data_part5,
            data_part6: medical_record.data_part6,
            data_part7: medical_record.data_part7,
            data_part8: medical_record.data_part8,
            record_type: medical_record.record_type,
            created_at: medical_record.created_at,
            version: medical_record.version,
        };

        let doctor_record: SharedMedicalRecord = SharedMedicalRecord {
            owner: doctor,
            record_id: medical_record.record_id,
            original_owner: self.caller,
            data_hash: medical_record.data_hash,
            data_part1: medical_record.data_part1,
            data_part2: medical_record.data_part2,
            data_part3: medical_record.data_part3,
            data_part4: medical_record.data_part4,
            data_part5: medical_record.data_part5,
            data_part6: medical_record.data_part6,
            data_part7: medical_record.data_part7,
            data_part8: medical_record.data_part8,
            record_type: medical_record.record_type,
            duration_blocks: safe_duration,
            access_token: access_token,
        };

        let caller: address = self.caller;
        let rid: field = medical_record.record_id;
        return (
            patient_record,
            doctor_record,
            access_token,
            final {
                finalize_share_record(caller, doctor, rid, access_token, safe_duration);
            }
        );
    }

    fn revoke_access(
        access_token: field
    ) -> Final {
        let caller: address = self.caller;
        return final { finalize_revoke_access(caller, access_token); };
    }
}
