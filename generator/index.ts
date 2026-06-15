import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';

const PRISMA_SCHEMA_PATH = './prisma/main/schema.prisma';
const TEMPLATES_DIR = './generator/templates';
const OUTPUT_DIR = './src/modules';
const SKIP_MODELS = ['Auth', 'RoleFeature'];
const SYSTEM_FIELDS = ['id', 'active', 'is_deleted', 'deleted_at', 'created_at', 'updated_at'];

interface ModelField {
  name: string;
  jsonType: string;
  tsType: string;
  typeBoxType: string;
  format?: string;
  isOptional: boolean;
  isId: boolean;
  isRelation: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isSystem: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
}

interface TemplateEntry {
  name: string;
  render: HandlebarsTemplateDelegate<{ 
    modelName: string; 
    modelLower: string;
    fields: ModelField[];
    createFields: ModelField[];
    updateFields: ModelField[];
    filterableFields: ModelField[];
    searchableFields: ModelField[];
    requiredCreateFields: string[];
  }>;
}

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a, b) => a === b);

async function loadTemplates(): Promise<TemplateEntry[]> {
  const files = await fs.readdir(TEMPLATES_DIR);
  const hbrFiles = files.filter(f => f.endsWith('.hbr'));

  return Promise.all(
    hbrFiles.map(async file => {
      const content = await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf-8');
      return {
        name: file.replace('.hbr', ''),
        render: Handlebars.compile(content)
      };
    })
  );
}

function extractModels(schema: string): string[] {
  return [...schema.matchAll(/model (\w+) {/g)].map(m => m[1]);
}

function extractModelFields(schema: string, modelName: string, allModels: string[]): ModelField[] {
  const modelRegex = new RegExp(`model ${modelName} {([\\s\\S]*?)}`, 'g');
  const match = modelRegex.exec(schema);
  if (!match) return [];

  const lines = match[1].split('\n');
  const fields: ModelField[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('@@') || trimmed.startsWith('//')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const name = parts[0];
    let type = parts[1];
    const attributes = parts.slice(2).join(' ');

    const isOptional = type.endsWith('?');
    const cleanType = type.replace('?', '').replace('[]', '');
    const isRelation = allModels.includes(cleanType);
    const isId = attributes.includes('@id');
    const isReadOnly = isId || attributes.includes('@default(now())') || attributes.includes('@updatedAt');
    const isSystem = SYSTEM_FIELDS.includes(name);
    
    let jsonType = 'string';
    let tsType = 'string';
    let format: string | undefined = undefined;
    let typeBoxCore = 'Type.String()';

    switch (cleanType) {
      case 'Int':
        jsonType = 'integer';
        tsType = 'number';
        typeBoxCore = 'Type.Integer()';
        break;
      case 'Float':
      case 'Decimal':
        jsonType = 'number';
        tsType = 'number';
        typeBoxCore = 'Type.Number()';
        break;
      case 'Boolean':
        jsonType = 'boolean';
        tsType = 'boolean';
        typeBoxCore = 'Type.Boolean()';
        break;
      case 'DateTime':
        jsonType = 'string';
        tsType = 'string';
        format = 'date-time';
        typeBoxCore = "Type.String({ format: 'date-time' })";
        break;
    }

    if (isId && cleanType === 'String') {
      format = 'uuid';
      typeBoxCore = "Type.String({ format: 'uuid' })";
    }

    let typeBoxType = typeBoxCore;
    if (isOptional) {
      typeBoxType = `Type.Optional(${typeBoxCore})`;
    }

    if (!isRelation) {
      fields.push({
        name,
        jsonType,
        tsType,
        typeBoxType,
        format,
        isOptional,
        isId,
        isRelation,
        isReadOnly,
        isSystem,
        isRequired: !isOptional && !isReadOnly && !isSystem && !attributes.includes('@default'),
        isFilterable: true,
        isSearchable: tsType === 'string' && !isId && !isSystem
      });
    }
  }

  return fields;
}

async function generate(): Promise<void> {
  console.log('Module Generator — Starting...\n');

  const targetEntity = process.argv[2];
  const schemaContent = await fs.readFile(PRISMA_SCHEMA_PATH, 'utf-8');
  const allModels = extractModels(schemaContent);
  const templates = await loadTemplates();

  const modelsToGenerate = targetEntity
    ? allModels.filter(m => m === targetEntity)
    : allModels.filter(m => !SKIP_MODELS.includes(m));

  if (targetEntity && modelsToGenerate.length === 0) {
    console.error(`Model "${targetEntity}" not found in schema.`);
    process.exit(1);
  }

  for (const modelName of modelsToGenerate) {
    const modelLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const moduleDir = path.join(OUTPUT_DIR, modelName);
    const fields = extractModelFields(schemaContent, modelName, allModels);

    const createFields = fields.filter(f => !f.isReadOnly && !f.isSystem);
    const updateFields = fields.filter(f => !f.isId && !f.isReadOnly && !f.isSystem);
    const filterableFields = fields.filter(f => f.isFilterable && !['created_at', 'updated_at'].includes(f.name));
    const searchableFields = fields.filter(f => f.isSearchable);
    const requiredCreateFields = createFields.filter(f => f.isRequired).map(f => f.name);

    try {
      await fs.access(moduleDir);
      if (!targetEntity) {
        console.log(`Skipping ${modelName} (directory already exists)`);
        continue;
      }
    } catch {}

    await fs.mkdir(moduleDir, { recursive: true });

    for (const template of templates) {
      const fileName = `${modelName}.${template.name}.ts`;
      let filePath = path.join(moduleDir, fileName);

      // Special case for tests: place in tests/modules/
      if (template.name === 'test') {
        const testsDir = './tests/modules';
        await fs.mkdir(testsDir, { recursive: true });
        filePath = path.join(testsDir, fileName);
      }

      const content = template.render({ 
        modelName, 
        modelLower, 
        fields,
        createFields,
        updateFields,
        filterableFields,
        searchableFields,
        requiredCreateFields
      });
      await fs.writeFile(filePath, content);
      console.log(`  ${fileName}`);
    }

    await registerNewModule(modelName);
  }

  console.log('\nGeneration Complete!');
}

async function registerNewModule(modelName: string): Promise<void> {
  const routesPath = './src/modules/register-modules.ts';
  const content = await fs.readFile(routesPath, 'utf-8');

  const modelLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const importName = `${modelLower}Routes`;
  const importLine = `import { ${importName} } from './${modelName}/${modelName}.routes.js';`;
  const registrationLine = `  await app.register(${importName}, { prefix: '/v1' });`;

  if (content.includes(importLine)) return;

  const newContent = content
    .replace('// [GENERATOR_IMPORTS]', `${importLine}\n// [GENERATOR_IMPORTS]`)
    .replace('  // [GENERATOR_REGISTRATIONS]', `${registrationLine}\n  // [GENERATOR_REGISTRATIONS]`);

  await fs.writeFile(routesPath, newContent);
  console.log(`  Registered ${modelName} routes`);
}

generate().catch(console.error);

