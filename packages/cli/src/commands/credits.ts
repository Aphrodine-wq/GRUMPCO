import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { GrumpError, handleApiError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';
import open from 'open';

interface CreditsOptions {
  buy?: boolean;
  amount?: number;
  history?: boolean;
}

const creditPackages = [
  { id: 'starter', name: 'Starter', credits: 100, price: 5, description: 'Perfect for trying out' },
  { id: 'pro', name: 'Pro', credits: 500, price: 20, description: 'Most popular choice' },
  { id: 'team', name: 'Team', credits: 2000, price: 75, description: 'Great for small teams' },
  { id: 'enterprise', name: 'Enterprise', credits: 10000, price: 350, description: 'Unlimited power' }
];

/**
 * Check credit balance and buy more
 */
export async function execute(options: CreditsOptions): Promise<void> {
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  
  console.log(branding.format('\n💳 Credit Management\n', 'title'));
  
  // Check if authenticated
  if (!config.hasApiKey()) {
    throw new GrumpError(
      'Authentication required',
      'AUTH_REQUIRED',
      undefined,
      ['Run `grump auth login` to authenticate', 'Set GRUMP_API_KEY environment variable']
    );
  }
  
  // Fetch current balance
  const balance = await withSpinner(
    'Fetching credit balance...',
    async () => {
      const response = await fetch(`${apiUrl}/api/credits/balance`, {
        headers
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'Balance retrieved'
  );
  
  const balanceData = balance as { 
    credits: number; 
    used_this_month: number;
    plan: string;
    next_billing: string;
  };
  
  // Display balance
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n💰 Current Balance:\n'));
  
  const creditsDisplay = balanceData.credits > 100 
    ? chalk.hex(branding.colors.lightPurple)(`${balanceData.credits} credits`)
    : chalk.hex(branding.colors.mediumPurple)(`${balanceData.credits} credits ⚠️`);
  
  console.log(`  Available: ${creditsDisplay}`);
  console.log(chalk.dim(`  Used this month: ${balanceData.used_this_month} credits`));
  console.log(chalk.dim(`  Plan: ${balanceData.plan}`));
  console.log(chalk.dim(`  Next billing: ${balanceData.next_billing}`));
  
  // Usage breakdown
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n📊 Usage Breakdown:\n'));
  
  try {
    const usageResponse = await fetch(`${apiUrl}/api/credits/usage`, { headers });
    if (usageResponse.ok) {
      const usage = await usageResponse.json() as { 
        breakdown: Array<{ feature: string; credits: number; percentage: number }> 
      };
      
      for (const item of usage.breakdown) {
        const bar = branding.getProgressBar(item.percentage, 20);
        console.log(`  ${item.feature.padEnd(15)} ${bar} ${item.credits} cr`);
      }
    }
  } catch {
    console.log(chalk.dim('  Usage details unavailable'));
  }
  
  // Show history if requested
  if (options.history) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n📝 Recent Transactions:\n'));
    
    try {
      const historyResponse = await fetch(`${apiUrl}/api/credits/history?limit=10`, { headers });
      if (historyResponse.ok) {
        const history = await historyResponse.json() as { 
          transactions: Array<{ date: string; description: string; amount: number; type: string }> 
        };
        
        for (const tx of history.transactions) {
          const color = tx.type === 'debit' ? branding.colors.mediumPurple : '#10B981';
          const sign = tx.type === 'debit' ? '-' : '+';
          console.log(chalk.hex(color)(
            `  ${tx.date}  ${tx.description.padEnd(30)} ${sign}${tx.amount} cr`
          ));
        }
      }
    } catch {
      console.log(chalk.dim('  Transaction history unavailable'));
    }
  }
  
  // Buy credits
  if (options.buy || balanceData.credits < 50) {
    console.log('\n' + branding.getDivider());
    
    if (balanceData.credits < 50) {
      console.log(chalk.hex(branding.colors.mediumPurple)('\n⚠️  Low balance warning!\n'));
    }
    
    console.log(chalk.hex(branding.colors.mediumPurple)('\n💳 Available Packages:\n'));
    
    for (const pkg of creditPackages) {
      const highlighted = pkg.id === 'pro' ? ' ← Most Popular' : '';
      console.log(chalk.hex(branding.colors.lightPurple)(
        `  ${pkg.name.padEnd(12)} ${pkg.credits.toLocaleString().padStart(6)} credits  $${pkg.price}`
      ) + chalk.hex('#F7931E')(highlighted));
      console.log(chalk.dim(`     ${pkg.description}`));
    }
    
    const { package: selectedPackage, confirm } = await askUser<{ package: string; confirm: boolean }>([
      {
        type: 'list',
        name: 'package',
        message: 'Select a package:',
        choices: creditPackages.map(p => ({
          name: `${p.name} - ${p.credits.toLocaleString()} credits ($${p.price})`,
          value: p.id
        }))
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed to checkout?',
        default: true
      }
    ]);
    
    if (confirm) {
      const pkg = creditPackages.find(p => p.id === selectedPackage);
      
      try {
        const checkoutResponse = await fetch(`${apiUrl}/api/credits/checkout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            package: selectedPackage,
            amount: pkg?.price
          })
        });
        
        if (!checkoutResponse.ok) {
          handleApiError(checkoutResponse);
        }
        
        const checkout = await checkoutResponse.json() as { url: string; session_id: string };
        
        console.log('\n' + branding.getDivider());
        console.log(chalk.hex(branding.colors.mediumPurple)('\n🔗 Opening checkout page...\n'));
        
        // Open browser
        await open(checkout.url);
        
        console.log(chalk.hex(branding.colors.lightPurple)(`  Checkout URL: ${checkout.url}`));
        console.log(chalk.dim('\n  Complete the payment in your browser.'));
        console.log(chalk.dim('  Credits will be added automatically after payment.'));
        
      } catch (error) {
        throw new GrumpError(
          'Failed to initiate checkout',
          'CHECKOUT_FAILED',
          undefined,
          ['Check your internet connection', 'Verify your API key', 'Try again later']
        );
      }
    }
  } else {
    console.log('\n' + branding.getDivider());
    console.log(chalk.dim('\nTip: Run `grump credits --buy` to purchase more credits'));
    console.log(chalk.dim('     Run `grump credits --history` to see transaction history'));
  }
}

export const creditsCommand = { execute };
