import chalk from 'chalk';

export async function completionCommand(options: { shell: string }) {
    const { shell } = options;

    const completions = {
        bash: `# G-Rump bash completion
_grump_completions()
{
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  opts="ship chat architect generate config models completion login usage doctor init --help --version"

  if [[ \${cur} == -* ]] ; then
    COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
    return 0
  fi

  case "\${prev}" in
    ship)
      # No file completion for ship command
      return 0
      ;;
    chat)
      COMPREPLY=( $(compgen -W "-i --interactive -m --model -p --provider" -- \${cur}) )
      return 0
      ;;
    architect)
      COMPREPLY=( $(compgen -W "-t --type -l --level -o --output" -- \${cur}) )
      return 0
      ;;
    generate)
      COMPREPLY=( $(compgen -W "--type -o --output" -- \${cur}) )
      return 0
      ;;
    *)
      ;;
  esac

  COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
  return 0
}

complete -F _grump_completions grump`,

        zsh: `#compdef grump

_grump() {
  local -a commands
  commands=(
    'ship:Transform project description into code'
    'chat:Interactive AI chat'
    'architect:Generate architecture diagrams'
    'generate:Generate code artifacts'
    'config:Manage configuration'
    'models:List AI models'
    'completion:Generate shell completion'
    'login:Authenticate with cloud'
    'usage:View AI usage and costs'
    'doctor:Check system health'
    'init:Initialize new project'
  )

  _arguments -C \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'grump command' commands
      ;;
    args)
      case $words[1] in
        ship)
          _arguments \\
            '-s[Tech stack]:stack:' \\
            '-t[Deployment target]:target:(docker vercel aws gcp)' \\
            '-o[Output directory]:directory:_files -/' \\
            '--no-interactive[Non-interactive mode]'
          ;;
        chat)
          _arguments \\
            '-i[Interactive mode]' \\
            '-m[AI model]:model:' \\
            '-p[AI provider]:provider:(nim anthropic openrouter)'
          ;;
        architect)
          _arguments \\
            '-t[Diagram type]:type:(c4 erd sequence flowchart)' \\
            '-l[C4 level]:level:(context container component code)' \\
            '-o[Output file]:file:_files'
          ;;
        generate)
          _arguments \\
            '--type[Generation type]:type:(frontend backend devops tests)' \\
            '-o[Output directory]:directory:_files -/'
          ;;
      esac
      ;;
  esac
}

_grump "$@"`,

        fish: `# G-Rump fish completion

complete -c grump -f

# Commands
complete -c grump -n "__fish_use_subcommand" -a ship -d "Transform project description into code"
complete -c grump -n "__fish_use_subcommand" -a chat -d "Interactive AI chat"
complete -c grump -n "__fish_use_subcommand" -a architect -d "Generate architecture diagrams"
complete -c grump -n "__fish_use_subcommand" -a generate -d "Generate code artifacts"
complete -c grump -n "__fish_use_subcommand" -a config -d "Manage configuration"
complete -c grump -n "__fish_use_subcommand" -a models -d "List AI models"
complete -c grump -n "__fish_use_subcommand" -a completion -d "Generate shell completion"
complete -c grump -n "__fish_use_subcommand" -a login -d "Authenticate with cloud"
complete -c grump -n "__fish_use_subcommand" -a usage -d "View AI usage and costs"
complete -c grump -n "__fish_use_subcommand" -a doctor -d "Check system health"
complete -c grump -n "__fish_use_subcommand" -a init -d "Initialize new project"

# Global options
complete -c grump -s h -l help -d "Show help"
complete -c grump -s v -l version -d "Show version"

# Ship options
complete -c grump -n "__fish_seen_subcommand_from ship" -s s -l stack -d "Preferred tech stack"
complete -c grump -n "__fish_seen_subcommand_from ship" -s t -l target -d "Deployment target" -a "docker vercel aws gcp"
complete -c grump -n "__fish_seen_subcommand_from ship" -s o -l output -d "Output directory" -r

# Chat options
complete -c grump -n "__fish_seen_subcommand_from chat" -s i -l interactive -d "Interactive mode"
complete -c grump -n "__fish_seen_subcommand_from chat" -s m -l model -d "AI model"
complete -c grump -n "__fish_seen_subcommand_from chat" -s p -l provider -d "AI provider" -a "nim anthropic openrouter"

# Architect options
complete -c grump -n "__fish_seen_subcommand_from architect" -s t -l type -d "Diagram type" -a "c4 erd sequence flowchart"
complete -c grump -n "__fish_seen_subcommand_from architect" -s l -l level -d "C4 level" -a "context container component code"
complete -c grump -n "__fish_seen_subcommand_from architect" -s o -l output -d "Output file" -r

# Generate options
complete -c grump -n "__fish_seen_subcommand_from generate" -l type -d "Generation type" -a "frontend backend devops tests"
complete -c grump -n "__fish_seen_subcommand_from generate" -s o -l output -d "Output directory" -r`,

        powershell: `# G-Rump PowerShell completion

Register-ArgumentCompleter -Native -CommandName grump -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commands = @(
        'ship', 'chat', 'architect', 'generate', 'config', 'models',
        'completion', 'login', 'usage', 'doctor', 'init'
    )

    $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
    }
}`,
    };

    const script = completions[shell as keyof typeof completions];

    if (!script) {
        console.error(chalk.red(`❌ Unsupported shell: ${shell}`));
        console.log(chalk.yellow('Supported shells: bash, zsh, fish, powershell'));
        process.exit(1);
    }

    console.log(script);
    console.log(chalk.yellow(`\n💡 To enable completion, add this to your shell config:\n`));

    switch (shell) {
        case 'bash':
            console.log(chalk.cyan('  grump completion --shell bash >> ~/.bashrc'));
            console.log(chalk.cyan('  source ~/.bashrc'));
            break;
        case 'zsh':
            console.log(chalk.cyan('  grump completion --shell zsh >> ~/.zshrc'));
            console.log(chalk.cyan('  source ~/.zshrc'));
            break;
        case 'fish':
            console.log(chalk.cyan('  grump completion --shell fish > ~/.config/fish/completions/grump.fish'));
            break;
        case 'powershell':
            console.log(chalk.cyan('  grump completion --shell powershell >> $PROFILE'));
            console.log(chalk.cyan('  . $PROFILE'));
            break;
    }
}
