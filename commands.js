// Generate Migration FIle
npx typeorm-ts-node-commonjs migration:generate ./src/migrations/create_role_table -d src/data-source.ts


<type>(<scope>): <description>

[optional body]

[optional footer(s)]

feat: A new feature for the user.

fix: A bug fix.

chore: Routine maintenance, updating dependencies, or build tool configurations (e.g., updating a .gitignore file).

refactor: Rewriting code without changing its external behavior (neither fixing a bug nor adding a feature).

docs: Changes to documentation (like updating a README.md).

style: Formatting changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons).

test: Adding missing tests or correcting existing tests.

perf: A code change that improves performance.