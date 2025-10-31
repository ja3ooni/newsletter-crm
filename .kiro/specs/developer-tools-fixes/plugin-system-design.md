# Plugin System, Templating & Prompt Cookbooks Design

## Overview

This document extends the developer tools design with an extensible plugin
system, advanced templating engine, and prompt cookbooks for AI-assisted
development.

## Plugin System Architecture

### Core Plugin Interface

```typescript
interface IDevToolPlugin {
  name: string;
  version: string;
  description: string;
  author: string;

  initialize(context: PluginContext): Promise<void>;
  execute(command: string, args: any[]): Promise<PluginResult>;
  getCommands(): PluginCommand[];
  cleanup(): Promise<void>;
}

interface PluginContext {
  logger: ILogger;
  config: IConfigurationService;
  platform: IPlatformService;
  utils: PluginUtilities;
}
```

### Plugin Manager

```typescript
class PluginManager {
  private plugins = new Map<string, IDevToolPlugin>();
  private pluginConfigs = new Map<string, PluginConfig>();

  async loadPlugin(pluginPath: string): Promise<void> {
    const plugin = await import(pluginPath);
    await plugin.initialize(this.createContext());
    this.plugins.set(plugin.name, plugin);
  }

  async executePlugin(
    name: string,
    command: string,
    args: any[]
  ): Promise<PluginResult> {
    const plugin = this.plugins.get(name);
    if (!plugin) throw new Error(`Plugin not found: ${name}`);

    return await plugin.execute(command, args);
  }
}
```

## Templating Engine

### Template System Architecture

```typescript
interface ITemplateEngine {
  registerTemplate(name: string, template: Template): void;
  renderTemplate(name: string, context: TemplateContext): Promise<string>;
  listTemplates(): TemplateInfo[];
  validateTemplate(template: Template): ValidationResult;
}

interface Template {
  name: string;
  description: string;
  category: TemplateCategory;
  variables: TemplateVariable[];
  content: string;
  hooks?: TemplateHooks;
}

enum TemplateCategory {
  Service = 'service',
  Component = 'component',
  Test = 'test',
  Documentation = 'documentation',
  Configuration = 'configuration',
  Workflow = 'workflow',
}
```

### Advanced Template Features

```typescript
class AdvancedTemplateEngine implements ITemplateEngine {
  private templates = new Map<string, Template>();
  private helpers = new Map<string, TemplateHelper>();

  registerHelper(name: string, helper: TemplateHelper): void {
    this.helpers.set(name, helper);
  }

  async renderTemplate(
    name: string,
    context: TemplateContext
  ): Promise<string> {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template not found: ${name}`);

    // Process template with Handlebars-like syntax
    let content = template.content;

    // Replace variables
    content = this.replaceVariables(content, context);

    // Process helpers
    content = await this.processHelpers(content, context);

    // Execute hooks
    if (template.hooks) {
      content = await this.executeHooks(template.hooks, content, context);
    }

    return content;
  }
}
```

## Prompt Cookbooks System

### Cookbook Architecture

```typescript
interface IPromptCookbook {
  name: string;
  description: string;
  category: CookbookCategory;
  prompts: PromptRecipe[];
  metadata: CookbookMetadata;
}

interface PromptRecipe {
  id: string;
  name: string;
  description: string;
  prompt: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

enum CookbookCategory {
  CodeGeneration = 'code-generation',
  Debugging = 'debugging',
  Testing = 'testing',
  Documentation = 'documentation',
  Architecture = 'architecture',
  Performance = 'performance',
  Security = 'security',
}
```

### Cookbook Manager

```typescript
class CookbookManager {
  private cookbooks = new Map<string, IPromptCookbook>();
  private favorites = new Set<string>();

  async loadCookbook(cookbookPath: string): Promise<void> {
    const cookbook = await this.parseCookbook(cookbookPath);
    this.cookbooks.set(cookbook.name, cookbook);
  }

  searchRecipes(query: string, category?: CookbookCategory): PromptRecipe[] {
    const allRecipes = Array.from(this.cookbooks.values()).flatMap(
      cookbook => cookbook.prompts
    );

    return allRecipes.filter(recipe => {
      const matchesQuery =
        recipe.name.includes(query) ||
        recipe.description.includes(query) ||
        recipe.tags.some(tag => tag.includes(query));

      const matchesCategory =
        !category || this.getCookbookByRecipe(recipe.id)?.category === category;

      return matchesQuery && matchesCategory;
    });
  }
}
```

## Built-in Plugin Examples

### 1. AI Code Assistant Plugin

```typescript
class AICodeAssistantPlugin implements IDevToolPlugin {
  name = 'ai-code-assistant';
  version = '1.0.0';
  description = 'AI-powered code generation and assistance';

  async execute(command: string, args: any[]): Promise<PluginResult> {
    switch (command) {
      case 'generate':
        return await this.generateCode(args[0], args[1]);
      case 'explain':
        return await this.explainCode(args[0]);
      case 'optimize':
        return await this.optimizeCode(args[0]);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private async generateCode(
    prompt: string,
    context: any
  ): Promise<PluginResult> {
    const recipe = await this.cookbookManager.findBestRecipe(prompt);
    const renderedPrompt = await this.templateEngine.render(
      recipe.prompt,
      context
    );

    return {
      success: true,
      data: {
        generatedCode: await this.aiService.generateCode(renderedPrompt),
        recipe: recipe.name,
        confidence: 0.95,
      },
    };
  }
}
```

### 2. Template Management Plugin

```typescript
class TemplateManagerPlugin implements IDevToolPlugin {
  name = 'template-manager';

  getCommands(): PluginCommand[] {
    return [
      { name: 'create', description: 'Create new template' },
      { name: 'list', description: 'List available templates' },
      { name: 'render', description: 'Render template with context' },
      { name: 'validate', description: 'Validate template syntax' },
    ];
  }
}
```

## Template Categories and Examples

### Service Templates

```yaml
# templates/service/microservice-basic.yaml
name: 'Basic Microservice'
category: service
description: 'Standard microservice with Express.js and TypeScript'
variables:
  - name: serviceName
    type: string
    description: 'Name of the service'
    required: true
  - name: withAuth
    type: boolean
    description: 'Include authentication'
    default: true
  - name: withDatabase
    type: boolean
    description: 'Include database integration'
    default: true

content: |
  import express from 'express';
  import { logger } from '@shared/utils/logger';
  {{#if withAuth}}
  import { authMiddleware } from '@shared/middleware/auth';
  {{/if}}

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(express.json());
  {{#if withAuth}}
  app.use('/api', authMiddleware);
  {{/if}}

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: '{{serviceName}}' });
  });

  app.listen(PORT, () => {
    logger.info(`{{serviceName}} service running on port ${PORT}`);
  });
```

### Component Templates

```yaml
# templates/component/react-component.yaml
name: 'React Component'
category: component
description: 'TypeScript React component with tests'
variables:
  - name: componentName
    type: string
    required: true
  - name: withProps
    type: boolean
    default: true
  - name: withState
    type: boolean
    default: false

content: |
  import React{{#if withState}}, { useState }{{/if}} from 'react';

  {{#if withProps}}
  interface {{componentName}}Props {
    // Define props here
  }
  {{/if}}

  export const {{componentName}}: React.FC{{#if withProps}}<{{componentName}}Props>{{/if}} = ({{#if withProps}}props{{/if}}) => {
    {{#if withState}}
    const [state, setState] = useState();
    {{/if}}

    return (
      <div className="{{kebabCase componentName}}">
        <h1>{{componentName}}</h1>
      </div>
    );
  };
```
