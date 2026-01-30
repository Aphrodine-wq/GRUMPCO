import chalk from 'chalk';
import inquirer from 'inquirer';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { createSpinner } from '../utils/progress.js';
import { handleApiError } from '../utils/errors.js';

interface ChatOptions {
  interactive: boolean;
  context?: string;
  session?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Quick chat with AI or interactive chat mode
 */
export async function execute(message: string | undefined, options: ChatOptions): Promise<void> {
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  
  if (options.interactive || !message) {
    await interactiveChat(apiUrl, headers, options.session);
  } else {
    await quickChat(apiUrl, headers, message, options);
  }
}

/**
 * Send a quick chat message
 */
async function quickChat(
  apiUrl: string, 
  headers: Record<string, string>, 
  message: string,
  options: ChatOptions
): Promise<void> {
  console.log(branding.format('Sending message to G-Rump...', 'subtitle'));
  console.log(chalk.dim(`You: ${message}\n`));
  
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: message }
  ];
  
  // Add context if provided
  if (options.context) {
    const { readFileSync } = await import('fs');
    try {
      const context = readFileSync(options.context, 'utf-8');
      messages.unshift({
        role: 'system',
        content: `Context from file ${options.context}:\n${context}`
      });
    } catch {
      console.log(branding.status(`Warning: Could not read context file ${options.context}`, 'warning'));
    }
  }
  
  const spinner = createSpinner({ text: 'G-Rump is thinking...' });
  spinner.start();
  
  try {
    const response = await fetch(`${apiUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { ...headers, 'Accept': 'text/event-stream' },
      body: JSON.stringify({
        messages,
        sessionId: options.session,
        stream: true
      })
    });
    
    if (!response.ok) {
      spinner.fail();
      handleApiError(response);
    }
    
    spinner.stop();
    console.log(branding.getMiniLogo() + chalk.hex('#FF6B35')(' G-Rump:'));
    console.log();
    
    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          try {
            const event = JSON.parse(data) as { type?: string; text?: string };
            if (event.type === 'text' && event.text) {
              process.stdout.write(event.text);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    }
    
    console.log('\n');
    
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Interactive chat session
 */
async function interactiveChat(
  apiUrl: string, 
  headers: Record<string, string>,
  sessionId?: string
): Promise<void> {
  console.log(branding.getLogo('compact'));
  console.log(chalk.hex('#F7931E')('Interactive Chat Mode'));
  console.log(chalk.dim('Type your message and press Enter. Type "exit" or press Ctrl+C to quit.\n'));
  
  const messages: ChatMessage[] = [];
  let currentSessionId = sessionId;
  
  while (true) {
    const { input } = await inquirer.prompt([{
      type: 'input',
      name: 'input',
      message: chalk.hex('#FF6B35')('You'),
      prefix: '☹️  '
    }]);
    
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('\n' + branding.getMiniLogo() + chalk.gray(' Goodbye! ☹️\n'));
      break;
    }
    
    if (!input.trim()) {
      continue;
    }
    
    // Add user message to history
    messages.push({
      role: 'user',
      content: input,
      timestamp: new Date()
    });
    
    // Show thinking indicator
    const spinner = createSpinner({ text: 'Thinking...' });
    spinner.start();
    
    try {
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { ...headers, 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          sessionId: currentSessionId,
          stream: true
        })
      });
      
      if (!response.ok) {
        spinner.fail();
        handleApiError(response);
      }
      
      spinner.stop();
      
      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      console.log('\n' + branding.getMiniLogo() + chalk.hex('#FF6B35')(' G-Rump:'));
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            try {
              const event = JSON.parse(data) as { type?: string; text?: string; sessionId?: string };
              if (event.type === 'text' && event.text) {
                process.stdout.write(event.text);
                fullResponse += event.text;
              }
              if (event.sessionId) {
                currentSessionId = event.sessionId;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      }
      
      // Add assistant response to history
      messages.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date()
      });
      
      console.log('\n');
      
    } catch (error) {
      spinner.fail();
      console.error(chalk.red('Error: '), error);
    }
  }
}

export const chatCommand = { execute };
