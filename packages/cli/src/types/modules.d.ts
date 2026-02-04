declare module 'gradient-string' {
  interface Gradient {
    (text: string): string;
    multiline(text: string): string;
  }

  function gradient(colors: string[]): Gradient;
  function gradient(...colors: string[]): Gradient;

  export = gradient;
}

declare module 'conf' {
  interface Options<T> {
    projectName?: string;
    defaults?: T;
    configName?: string;
    cwd?: string;
  }

  class Conf<T = unknown> {
    constructor(options?: Options<T>);
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
    has<K extends keyof T>(key: K): boolean;
    delete<K extends keyof T>(key: K): void;
    clear(): void;
    path: string;
    size: number;
    store: T;
  }

  export = Conf;
}

declare module 'ora' {
  interface Options {
    text?: string;
    spinner?: string | object;
    color?: string;
    interval?: number;
    stream?: NodeJS.WritableStream;
  }

  interface Ora {
    start(): Ora;
    stop(): Ora;
    succeed(text?: string): Ora;
    fail(text?: string): Ora;
    warn(text?: string): Ora;
    info(text?: string): Ora;
    clear(): Ora;
    render(): Ora;
    frame(): string;
    text: string;
    color: string;
    spinner: object;
  }

  function ora(options?: Options | string): Ora;
  export = ora;
}

declare module 'inquirer' {
  interface Question {
    type?: string;
    name: string;
    message?: string | ((answers: any) => string);
    default?: any | ((answers: any) => any);
    choices?: Array<string | { name: string; value: any; short?: string }>;
    validate?: (input: any, answers?: any) => boolean | string | Promise<boolean | string>;
    filter?: (input: any) => any;
    when?: boolean | ((answers: any) => boolean);
    prefix?: string;
    mask?: string | boolean;
  }

  interface PromptModule {
    <T = any>(questions: Question | Question[]): Promise<T>;
  }

  const prompt: PromptModule;
  export = prompt;
}
