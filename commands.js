// Generate Migration FIle
npx typeorm-ts-node-commonjs migration:generate ./src/migrations/{{migrationName}} -d src/data-source.ts