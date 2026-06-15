import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';

const TEMPLATES_DIR = './generator/templates';
const JOBS_DIR = './src/jobs';
const TESTS_DIR = './tests/jobs';
const REGISTER_PATH = './src/jobs/register-jobs.ts';

interface JobTemplateVars {
  Name: string;
  name: string;
  schedule: string;
  description: string;
}

function toPascalCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .flatMap(part =>
      part
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    )
    .join('');
}

function pascalToKebab(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

async function loadTemplate(filename: string): Promise<HandlebarsTemplateDelegate<JobTemplateVars>> {
  const content = await fs.readFile(path.join(TEMPLATES_DIR, filename), 'utf-8');
  return Handlebars.compile<JobTemplateVars>(content);
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function updateRegisterJobs(name: string): Promise<void> {
  const content = await fs.readFile(REGISTER_PATH, 'utf-8');

  const importLine = `import { ${name}Job } from './${name}Job.js';`;
  const instanceLine = `    new ${name}Job(),`;

  if (content.includes(importLine)) {
    console.log(`  ${name}Job already registered (skipped)`);
    return;
  }

  const newContent = content
    .replace('// [GENERATOR_IMPORTS]', `${importLine}\n// [GENERATOR_IMPORTS]`)
    .replace('// [GENERATOR_JOBS]', `${instanceLine}\n    // [GENERATOR_JOBS]`);

  await fs.writeFile(REGISTER_PATH, newContent);
  console.log(`  Registered ${name}Job in register-jobs.ts`);
}

async function generate(): Promise<void> {
  console.log('Job Generator — Starting...\n');

  const rawName = process.argv[2];
  const schedule = process.argv[3] || '0 3 * * *';
  const description = process.argv[4] || 'TBD';

  if (!rawName) {
    console.error('Usage: bun run generate:job <Name> [schedule] [description]');
    console.error('');
    console.error('Examples:');
    console.error('  bun run generate:job CleanupOldRecords');
    console.error('  bun run generate:job CleanupOldRecords "0 3 * * *" "Remove records older than 90 days"');
    console.error('  bun run generate:job SendWelcomeEmail "0 9 * * 1" "Send weekly digest"');
    console.error('');
    console.error('Name is case-insensitive and accepts kebab/snake/pascal. Job suffix is added if missing.');
    process.exit(1);
  }

  const pascal = toPascalCase(rawName);
  const Name = pascal.endsWith('Job') ? pascal.slice(0, -3) : pascal;
  const name = pascalToKebab(Name);

  const vars: JobTemplateVars = { Name, name, schedule, description };

  console.log('Generating job:');
  console.log(`  File:        ${JOBS_DIR}/${Name}Job.ts`);
  console.log(`  Test:        ${TESTS_DIR}/${Name}Job.test.ts`);
  console.log(`  Class:       ${Name}Job`);
  console.log(`  name:        ${name}`);
  console.log(`  schedule:    ${schedule}`);
  console.log(`  description: ${description}`);
  console.log();

  const jobFile = path.join(JOBS_DIR, `${Name}Job.ts`);
  const testFile = path.join(TESTS_DIR, `${Name}Job.test.ts`);

  if (await fileExists(jobFile)) {
    console.error(`❌ File already exists: ${jobFile}`);
    console.error('   Delete it first or pick a different name.');
    process.exit(1);
  }

  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(TESTS_DIR, { recursive: true });

  const jobTpl = await loadTemplate('job.ts.tpl');
  const testTpl = await loadTemplate('job.test.ts.tpl');

  await fs.writeFile(jobFile, jobTpl(vars));
  console.log(`  ✓ ${jobFile}`);

  await fs.writeFile(testFile, testTpl(vars));
  console.log(`  ✓ ${testFile}`);

  await updateRegisterJobs(Name);

  console.log('\n✅ Generation complete!');
  console.log('\nNext steps:');
  console.log(`  1. Implement handle() in src/jobs/${Name}Job.ts`);
  console.log(`  2. Run: bun run test:coverage`);
  console.log(`  3. Run: bun run dev (to see it scheduled)`);
}

generate().catch(err => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
