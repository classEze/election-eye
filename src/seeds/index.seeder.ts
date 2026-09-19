import initialSeeder from './initial.seeder';

export const seeders = [{ name: 'initial', run: initialSeeder }];

export type seeder = (typeof seeders)[number];
