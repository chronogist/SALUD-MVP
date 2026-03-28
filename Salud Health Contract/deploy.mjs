import { Account, AleoNetworkClient, ProgramManager, AleoKeyProvider, initThreadPool } from '@provablehq/sdk';
import fs from 'fs';

async function main() {
  console.log('Initializing thread pool...');
  await initThreadPool();

  const privateKey = 'APrivateKey1zkpCrUpbkMau9C7UqgLhxhoRu5TEgY6MUvdzTLzobcmDFqt';
  const endpoint = 'https://api.explorer.provable.com/v1';

  const account = new Account({ privateKey });
  console.log('Deployer address:', account.address().to_string());

  const networkClient = new AleoNetworkClient(endpoint);

  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);

  const programManager = new ProgramManager(endpoint, keyProvider, networkClient);
  programManager.setAccount(account);

  const programSource = fs.readFileSync('./build/main.aleo', 'utf-8');
  const programName = programSource.match(/program\s+(\S+);/)?.[1] || 'unknown';
  console.log(`Program: ${programName}`);

  // Check if program already exists
  try {
    const existing = await networkClient.getProgram(programName);
    if (existing) {
      console.log('Program already exists on-chain. Use upgrade instead.');
      return;
    }
  } catch {
    console.log('Program not found on-chain — proceeding with deployment.');
  }

  // Fee in microcredits (13 credits)
  const fee = 13_000_000;
  console.log(`Fee: ${fee / 1_000_000} credits`);

  try {
    console.log('Building and broadcasting deployment transaction...');
    const txId = await programManager.deploy(programSource, fee, false);
    console.log('Deployment broadcast successful!');
    console.log('Transaction ID:', txId);
  } catch (error) {
    console.error('Deployment failed:', error);
  }
}

main();
