import { DataSource } from 'typeorm';
import { RoleCode } from '../features/role/role.enum';

export default async function seedData(dataSource: DataSource): Promise<void> {
  try {
    await dataSource.query(`
      INSERT INTO "roles" (name, code, type, description, status, created_at, updated_at) VALUES
      ('LGA Coordinator', '${RoleCode.LGA_COORDINATOR}', 'CLIENT', 'Manages results and monitors incidents across an entire Local Government Area.', true, NOW(), NOW()),
      ('Ward Coordinator', '${RoleCode.WARD_COORDINATOR}', 'CLIENT', 'Supervises polling unit agents and verifies incoming results within a specific Ward.', true, NOW(), NOW()),
      ('Polling Unit Agent', '${RoleCode.PU_AGENT}', 'CLIENT', 'Submits real-time polling unit results and logs field incidents directly at the booth.', true, NOW(), NOW()),
      ('Client Administrator', '${RoleCode.CLIENT_ADMIN}', 'CLIENT', 'Manages client-side operations and user accounts.', true, NOW(), NOW()),
      ('System Administrator', '${RoleCode.SYSTEM_ADMIN}', 'ADMIN', 'Oversees the entire system and manages user accounts.', true, NOW(), NOW()),
      ('Super Administrator', '${RoleCode.SUPER_ADMIN}', 'ADMIN', 'Has full access to all system functionalities and can manage other administrators.', true, NOW(), NOW()),
      ('Aspirant', '${RoleCode.ASPIRANT}', 'CLIENT', 'Aspirant account', true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    `);

    // ==========================================
    // 1. SEED SUPER ADMIN USER
    // ==========================================
    await dataSource.query(`
      INSERT INTO "admins" (first_name, last_name, email_address, phone_number, password, role_id, status, is_verified, force_password_reset, created_at, updated_at) VALUES
      ('Chibeze', 'Ochonogor', 'chibeze.ochonogor@gmail.com', '2348160245148', '$2b$12$ojS9n48YBNyir4EKgHfEru5LYODXaDnCBmiS1Va0ai3wmNc5hXnV2',
      (SELECT id FROM "roles" WHERE code = '${RoleCode.SUPER_ADMIN}'), 'active', true, false, NOW(), NOW())
      ON CONFLICT (email_address) DO NOTHING;
    `);

    // ==========================================
    // 2. SEED INCIDENT CATEGORIES
    // ==========================================
    await dataSource.query(`
      INSERT INTO "incident_categories" (name, code, description, status, created_at, updated_at) VALUES
      ('Ballot Box Snatching', 'BALLOT_SNATCHING', 'Forcible removal or theft of ballot boxes from the polling station.', 'active', NOW(), NOW()),
      ('Vote Buying', 'VOTE_BUYING', 'Financial inducements or distribution of materials to voters to influence choices.', 'active', NOW(), NOW()),
      ('BVAS Malfunction', 'BVAS_MALFUNCTION', 'Technical delays, biometric authentication issues, or complete device breakdown.', 'active', NOW(), NOW()),
      ('Late Arrival of Officials', 'LATE_START', 'INEC officials or voting materials arrived past the stipulated official start time.', 'active', NOW(), NOW()),
      ('Violence / Thuggery', 'VIOLENCE', 'Physical altercations, intimidation, armed presence, or disruptive riots.', 'active', NOW(), NOW()),
      ('Peaceful Protest / Delays', 'PROTEST', 'Voter agitations or structured demonstrations disrupting regular polling workflows.', 'active', NOW(), NOW()),
      ('Other Disruption', 'OTHER', 'Unclassified structural errors, geographical issues, or environmental emergencies.', 'active', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    `);

    // ==========================================
    // 3. SEED REGISTERED POLITICAL PARTIES (INEC 2026)
    // ==========================================
    await dataSource.query(`
      INSERT INTO "political_parties" (name, code, party_color_hex, status, created_at, updated_at) VALUES
      ('All Progressives Congress', 'APC', '#00BFFF', 'active', NOW(), NOW()),
      ('Peoples Democratic Party', 'PDP', '#008000', 'active', NOW(), NOW()),
      ('Labour Party', 'LP', '#FF0000', 'active', NOW(), NOW()),
      ('New Nigeria Peoples Party', 'NNPP', '#FFD700', 'active', NOW(), NOW()),
      ('All Progressives Grand Alliance', 'APGA', '#006400', 'active', NOW(), NOW()),
      ('Social Democratic Party', 'SDP', '#FF8C00', 'active', NOW(), NOW()),
      ('African Democratic Congress', 'ADC', '#00008B', 'active', NOW(), NOW()),
      ('Zenith Labour Party', 'ZLP', '#FF1493', 'active', NOW(), NOW()),
      ('Young Progressives Party', 'YPP', '#8B008B', 'active', NOW(), NOW()),
      ('People’s Redemption Party', 'PRP', '#800000', 'active', NOW(), NOW()),
      ('Action Democratic Party', 'ADP', '#A0522D', 'active', NOW(), NOW()),
      ('Allied People’s Movement', 'APM', '#2E8B57', 'active', NOW(), NOW()),
      ('National Rescue Movement', 'NRM', '#4682B4', 'active', NOW(), NOW()),
      ('Boot Party', 'BP', '#D2691E', 'active', NOW(), NOW()),
      ('Accord', 'A', '#FF7F50', 'active', NOW(), NOW()),
      ('Action Alliance', 'AA', '#7FFF00', 'active', NOW(), NOW()),
      ('African Action Congress', 'AAC', '#DC143C', 'active', NOW(), NOW()),
      ('Action Patriotic Party', 'APP', '#00FFFF', 'active', NOW(), NOW()),
      ('New Nigeria Party', 'NNP', '#4B0082', 'active', NOW(), NOW()),
      ('Youth Democratic Party', 'YDP', '#FF4500', 'active', NOW(), NOW()),
      ('Democratic Leadership Alliance', 'DLA', '#48D1CC', 'active', NOW(), NOW()),
      ('Nigeria Democratic Congress', 'NDC', '#8A2BE2', 'active', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    `);

    // ==========================================
    // 4. SEED DEFAULT SYSTEM CONFIGURATION
    // ==========================================
    await dataSource.query(`
      INSERT INTO "system_configurations" (
        id,
        is_voting_active,
        allow_agent_submissions,
        allow_incident_reporting,
        maintenance_mode,
        enable_otp,
        otp_validity,
        password_minimum_length,
        maximum_login_attempts,
        maximum_upload_size,
        maximum_files_per_submission,
        allowed_image_format,
        require_result_sheet,
        require_incident_evidence,
        mandatory_result_fields,
        mandatory_incident_fields,
        submission_close_notice,
        voting_start_time,
        voting_end_time,
        updated_by_admin_id,
        created_at,
        updated_at
      )
      VALUES (
        1,
        true,
        true,
        true,
        false,
        false,
        300,
        8,
        5,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        'The voting and result collation window is currently closed. Submissions are temporarily disabled.',
        NULL,
        NULL,
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  } catch (err) {
    console.log('Initial Seed migration failed', err);
  }
}
