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
      INSERT INTO "admins" (first_name, last_name, email_address, phone_number, password, role_id, is_active, is_verified, force_password_reset, created_at, updated_at) VALUES
      ('Chibeze', 'Ochonogor', 'chibeze.ochonogor@gmail.com', '2348160245148', '$2b$12$ojS9n48YBNyir4EKgHfEru5LYODXaDnCBmiS1Va0ai3wmNc5hXnV2',
      (SELECT id FROM "roles" WHERE code = '${RoleCode.SUPER_ADMIN}'), true, true, false, NOW(), NOW())
      ON CONFLICT (email_address) DO NOTHING;
    `);

    // ==========================================
    // 2. SEED INCIDENT CATEGORIES
    // ==========================================
    await dataSource.query(`
      INSERT INTO "incident_categories" (name, code, description, is_active, created_at, updated_at) VALUES
      ('Ballot Box Snatching', 'BALLOT_SNATCHING', 'Forcible removal or theft of ballot boxes from the polling station.', true, NOW(), NOW()),
      ('Vote Buying', 'VOTE_BUYING', 'Financial inducements or distribution of materials to voters to influence choices.', true, NOW(), NOW()),
      ('BVAS Malfunction', 'BVAS_MALFUNCTION', 'Technical delays, biometric authentication issues, or complete device breakdown.', true, NOW(), NOW()),
      ('Late Arrival of Officials', 'LATE_START', 'INEC officials or voting materials arrived past the stipulated official start time.', true, NOW(), NOW()),
      ('Violence / Thuggery', 'VIOLENCE', 'Physical altercations, intimidation, armed presence, or disruptive riots.', true, NOW(), NOW()),
      ('Peaceful Protest / Delays', 'PROTEST', 'Voter agitations or structured demonstrations disrupting regular polling workflows.', true, NOW(), NOW()),
      ('Other Disruption', 'OTHER', 'Unclassified structural errors, geographical issues, or environmental emergencies.', true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    `);

    // ==========================================
    // 3. SEED REGISTERED POLITICAL PARTIES (INEC 2026)
    // ==========================================
    await dataSource.query(`
      INSERT INTO "political_parties" (name, code, party_color_hex, is_active, created_at, updated_at) VALUES
      ('All Progressives Congress', 'APC', '#00BFFF', true, NOW(), NOW()),
      ('Peoples Democratic Party', 'PDP', '#008000', true, NOW(), NOW()),
      ('Labour Party', 'LP', '#FF0000', true, NOW(), NOW()),
      ('New Nigeria Peoples Party', 'NNPP', '#FFD700', true, NOW(), NOW()),
      ('All Progressives Grand Alliance', 'APGA', '#006400', true, NOW(), NOW()),
      ('Social Democratic Party', 'SDP', '#FF8C00', true, NOW(), NOW()),
      ('African Democratic Congress', 'ADC', '#00008B', true, NOW(), NOW()),
      ('Zenith Labour Party', 'ZLP', '#FF1493', true, NOW(), NOW()),
      ('Young Progressives Party', 'YPP', '#8B008B', true, NOW(), NOW()),
      ('People’s Redemption Party', 'PRP', '#800000', true, NOW(), NOW()),
      ('Action Democratic Party', 'ADP', '#A0522D', true, NOW(), NOW()),
      ('Allied People’s Movement', 'APM', '#2E8B57', true, NOW(), NOW()),
      ('National Rescue Movement', 'NRM', '#4682B4', true, NOW(), NOW()),
      ('Boot Party', 'BP', '#D2691E', true, NOW(), NOW()),
      ('Accord', 'A', '#FF7F50', true, NOW(), NOW()),
      ('Action Alliance', 'AA', '#7FFF00', true, NOW(), NOW()),
      ('African Action Congress', 'AAC', '#DC143C', true, NOW(), NOW()),
      ('Action Patriotic Party', 'APP', '#00FFFF', true, NOW(), NOW()),
      ('New Nigeria Party', 'NNP', '#4B0082', true, NOW(), NOW()),
      ('Youth Democratic Party', 'YDP', '#FF4500', true, NOW(), NOW()),
      ('Democratic Leadership Alliance', 'DLA', '#48D1CC', true, NOW(), NOW()),
      ('Nigeria Democratic Congress', 'NDC', '#8A2BE2', true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
    `);
    // ==========================================
    // 1. SEED SYSTEM ROLES
    // ==========================================
  } catch (err) {
    console.log('Initial Seed migration failed', err);
  }
}
