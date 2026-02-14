/**
 * AST-Aware Code Generation Service
 * Uses ts-morph to build AST programmatically instead of string generation
 * Guarantees zero syntax errors through AST validation before emission
 */

import { Project, StructureKind, Scope } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import logger from '../../middleware/logger.js';

/**
 * Code generation options
 */
export interface GenerationOptions {
  /** Target TypeScript version */
  target?: 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext';
  /** Module system */
  module?: 'CommonJS' | 'ESNext' | 'NodeNext';
  /** Include declaration files */
  declaration?: boolean;
  /** Strict mode */
  strict?: boolean;
  /** Output directory */
  outDir?: string;
}

/**
 * Generated file result
 */
export interface GeneratedFile {
  path: string;
  content: string;
  isValid: boolean;
  diagnostics: string[];
}

/**
 * Code generation error
 */
export class CodeGenerationError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: string[],
    public readonly filePath?: string
  ) {
    super(message);
    this.name = 'CodeGenerationError';
  }
}

/**
 * AST Generator Service
 * Provides type-safe code generation using ts-morph
 */
export class AstGeneratorService {
  private project: any;
  private options: GenerationOptions;

  constructor(options: GenerationOptions = {}) {
    this.options = {
      target: 'ES2022',
      module: 'ESNext',
      declaration: true,
      strict: true,
      outDir: './dist',
      ...options,
    };

    this.project = new Project({
      compilerOptions: {
        target: this.options.target,
        module: this.options.module,
        declaration: this.options.declaration,
        strict: this.options.strict,
        outDir: this.options.outDir,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
    });
  }

  /**
   * Create a new source file
   */
  createSourceFile(filePath: string, content?: string): any {
    return this.project.createSourceFile(filePath, content);
  }

  /**
   * Validate a source file for syntax errors
   */
  validateSourceFile(sourceFile: any): {
    isValid: boolean;
    diagnostics: string[];
  } {
    const diagnostics = sourceFile.getPreEmitDiagnostics();
    const errors = diagnostics.map(
      (d: { getMessageText: () => string | { getMessageText: () => string } }) => {
        const message = d.getMessageText();
        return typeof message === 'string' ? message : message.getMessageText();
      }
    );

    return {
      isValid: errors.length === 0,
      diagnostics: errors,
    };
  }

  /**
   * Emit a source file to string with validation
   * @throws CodeGenerationError if validation fails
   */
  emitSourceFile(sourceFile: any, validate = true): GeneratedFile {
    if (validate) {
      const validation = this.validateSourceFile(sourceFile);
      if (!validation.isValid) {
        throw new CodeGenerationError(
          `Source file '${sourceFile.getFilePath()}' has syntax errors`,
          validation.diagnostics,
          sourceFile.getFilePath()
        );
      }
    }

    return {
      path: sourceFile.getFilePath(),
      content: sourceFile.getFullText(),
      isValid: true,
      diagnostics: [],
    };
  }

  /**
   * Create an interface with validation
   */
  createInterface(sourceFile: any, structure: any): GeneratedFile {
    sourceFile.addInterface(structure);
    return this.emitSourceFile(sourceFile);
  }

  /**
   * Create a function with validation
   */
  createFunction(sourceFile: any, structure: any): GeneratedFile {
    sourceFile.addFunction(structure);
    return this.emitSourceFile(sourceFile);
  }

  /**
   * Create a type alias with validation
   */
  createTypeAlias(sourceFile: any, structure: any): GeneratedFile {
    sourceFile.addTypeAlias(structure);
    return this.emitSourceFile(sourceFile);
  }

  /**
   * Create an import declaration
   */
  createImport(sourceFile: any, structure: any): void {
    sourceFile.addImportDeclaration(structure);
  }

  /**
   * Create a variable declaration
   */
  createVariable(sourceFile: any, structure: any): void {
    sourceFile.addVariableStatement({
      declarationKind: StructureKind.VariableDeclaration,
      declarations: [structure],
    });
  }

  /**
   * Create a class with validation
   */
  createClass(sourceFile: any, structure: any): GeneratedFile {
    sourceFile.addClass(structure);
    return this.emitSourceFile(sourceFile);
  }

  /**
   * Generate a service class with common patterns
   */
  generateServiceClass(
    filePath: string,
    className: string,
    options: {
      dependencies?: Array<{ name: string; type: string }>;
      methods?: Array<{
        name: string;
        parameters?: Array<{ name: string; type: string }>;
        returnType?: string;
        isAsync?: boolean;
        body?: string | any;
      }>;
      imports?: Array<{ module: string; named?: string[]; default?: string }>;
    } = {}
  ): GeneratedFile {
    const sourceFile = this.createSourceFile(filePath);

    // Add imports
    if (options.imports) {
      for (const imp of options.imports) {
        this.createImport(sourceFile, {
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier: imp.module,
          namedImports: imp.named?.map((name) => ({ name })),
          defaultImport: imp.default,
        });
      }
    }

    // Add logger import by default
    this.createImport(sourceFile, {
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: '../middleware/logger.js',
      defaultImport: 'logger',
    });

    // Build class structure
    const classStructure: any = {
      kind: StructureKind.Class,
      name: className,
      isExported: true,
      properties: options.dependencies?.map((dep) => ({
        kind: StructureKind.Property,
        name: dep.name,
        type: dep.type,
        scope: Scope.Private,
      })),
      methods: options.methods?.map((method) => ({
        kind: StructureKind.Method,
        name: method.name,
        parameters: method.parameters?.map((p) => ({
          kind: StructureKind.Parameter,
          name: p.name,
          type: p.type,
        })),
        returnType: method.returnType,
        isAsync: method.isAsync,
        statements: typeof method.body === 'string' ? [method.body] : method.body,
        scope: Scope.Public,
      })),
    };

    // Add constructor if dependencies exist
    if (options.dependencies && options.dependencies.length > 0) {
      classStructure.ctors = [
        {
          kind: StructureKind.Constructor,
          parameters: options.dependencies.map((dep) => ({
            kind: StructureKind.Parameter,
            name: dep.name,
            type: dep.type,
          })),
          statements: options.dependencies.map((dep) => `this.${dep.name} = ${dep.name};`),
        },
      ];
    }

    sourceFile.addClass(classStructure);
    return this.emitSourceFile(sourceFile);
  }

  /**
   * Generate an API route handler
   */
  generateRouteHandler(
    filePath: string,
    routeName: string,
    options: {
      method: 'get' | 'post' | 'put' | 'delete' | 'patch';
      path: string;
      handler: string | any;
      imports?: Array<{ module: string; named?: string[]; default?: string }>;
      middleware?: string[];
    }
  ): GeneratedFile {
    const sourceFile = this.createSourceFile(filePath);

    // Add imports
    if (options.imports) {
      for (const imp of options.imports) {
        this.createImport(sourceFile, {
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier: imp.module,
          namedImports: imp.named?.map((name) => ({ name })),
          defaultImport: imp.default,
        });
      }
    }

    // Add Express imports
    this.createImport(sourceFile, {
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: 'express',
      namedImports: [{ name: 'Request' }, { name: 'Response' }, { name: 'Router' }],
    });

    // Create router
    sourceFile.addVariableStatement({
      declarationKind: StructureKind.VariableDeclaration,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: 'router',
          initializer: 'Router()',
        },
      ],
    });

    // Add route
    const methodStatements = options.middleware
      ? [...options.middleware.map((m) => `${m},`), options.handler]
      : [options.handler];

    sourceFile.addStatements(
      `router.${options.method}('${options.path}', ${methodStatements.join(', ')});`
    );

    // Export router
    sourceFile.addStatements(`export default router;`);

    return this.emitSourceFile(sourceFile);
  }

  /**
   * Generate a validation schema using Zod
   */
  generateZodSchema(
    filePath: string,
    schemaName: string,
    fields: Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'enum';
      required?: boolean;
      validations?: Array<{ method: string; args?: unknown[] }>;
      enumValues?: string[];
      itemType?: string;
    }>
  ): GeneratedFile {
    const sourceFile = this.createSourceFile(filePath);

    // Import zod
    this.createImport(sourceFile, {
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: 'zod',
      namedImports: [{ name: 'z' }],
    });

    // Build schema object
    const fieldDefinitions = fields.map((field) => {
      let zodCall = `z.`;

      switch (field.type) {
        case 'string':
          zodCall += 'string()';
          break;
        case 'number':
          zodCall += 'number()';
          break;
        case 'boolean':
          zodCall += 'boolean()';
          break;
        case 'date':
          zodCall += 'date()';
          break;
        case 'array':
          zodCall += `array(${field.itemType ?? 'z.any()'})`;
          break;
        case 'object':
          zodCall += 'object({})';
          break;
        case 'enum':
          zodCall += `enum([${field.enumValues?.map((v) => `'${v}'`).join(', ') ?? ''}])`;
          break;
      }

      // Add validations
      if (field.validations) {
        for (const validation of field.validations) {
          const args = validation.args?.map((a) => JSON.stringify(a)).join(', ') ?? '';
          zodCall += `.${validation.method}(${args})`;
        }
      }

      // Make optional if not required
      if (field.required === false) {
        zodCall += '.optional()';
      }

      return `${field.name}: ${zodCall}`;
    });

    // Create schema export
    sourceFile.addStatements(
      `export const ${schemaName} = z.object({\n  ${fieldDefinitions.join(',\n  ')}\n});`
    );

    // Add inferred type
    sourceFile.addStatements(
      `export type ${schemaName.replace('Schema', '')} = z.infer<typeof ${schemaName}>;`
    );

    return this.emitSourceFile(sourceFile);
  }

  /**
   * Batch generate multiple files
   */
  async generateBatch(
    generators: Array<() => GeneratedFile | Promise<GeneratedFile>>
  ): Promise<GeneratedFile[]> {
    const results: GeneratedFile[] = [];

    for (const generator of generators) {
      try {
        const result = await generator();
        results.push(result);
      } catch (error) {
        if (error instanceof CodeGenerationError) {
          logger.error(
            { error: error.message, diagnostics: error.diagnostics },
            'Code generation failed'
          );
        }
        throw error;
      }
    }

    return results;
  }

  /**
   * Clear all source files from the project
   */
  clear(): void {
    this.project.getSourceFiles().forEach((sf: any) => sf.delete());
  }

  /**
   * Get diagnostic information for all source files
   */
  getDiagnostics(): Array<{ filePath: string; diagnostics: string[] }> {
    return this.project.getSourceFiles().map((sf: any) => ({
      filePath: sf.getFilePath(),
      diagnostics: this.validateSourceFile(sf).diagnostics,
    }));
  }
}

/**
 * Singleton instance for convenience
 */
let defaultService: AstGeneratorService | null = null;

export function getAstGeneratorService(options?: GenerationOptions): AstGeneratorService {
  if (!defaultService) {
    defaultService = new AstGeneratorService(options);
  }
  return defaultService;
}

export function resetAstGeneratorService(): void {
  defaultService = null;
}

/**
 * Convenience function to generate a service class
 */
export function generateService(
  className: string,
  options: Parameters<AstGeneratorService['generateServiceClass']>[2],
  filePath?: string
): GeneratedFile {
  const service = getAstGeneratorService();
  const path = filePath ?? `src/services/${className.toLowerCase()}.ts`;
  return service.generateServiceClass(path, className, options);
}

/**
 * Convenience function to generate a route handler
 */
export function generateRoute(
  routeName: string,
  options: Parameters<AstGeneratorService['generateRouteHandler']>[2],
  filePath?: string
): GeneratedFile {
  const service = getAstGeneratorService();
  const path = filePath ?? `src/routes/${routeName.toLowerCase()}.ts`;
  return service.generateRouteHandler(path, routeName, options);
}

/**
 * Convenience function to generate a Zod schema
 */
export function generateSchema(
  schemaName: string,
  fields: Parameters<AstGeneratorService['generateZodSchema']>[2],
  filePath?: string
): GeneratedFile {
  const service = getAstGeneratorService();
  const path = filePath ?? `src/schemas/${schemaName.toLowerCase().replace('schema', '')}.ts`;
  return service.generateZodSchema(path, schemaName, fields);
}
