import Redis from 'ioredis';
import Redlock from 'redlock';
import fs from 'fs';
import path from 'path';

const redis = new Redis();
const redlock = new Redlock(
  [redis],
  {
    driftFactor: 0.01,
    retryCount: 5,
    retryDelay: 200,
    retryJitter: 200,
  });

async function findAndUpdate(num: number, name: string) {
  console.log(`Buy: ${num}`)

  const filePath = path.join(__dirname, `productstore.txt`);
  const data = await fs.promises.readFile(filePath, 'utf8');

  let currentValue = parseInt(data, 10) || 0;

  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log(`Current item in store ${currentValue}`);

  const updatedValue = currentValue - num;
  if (updatedValue < 0) {
    console.warn(`${name}: Buy ${num} but sold out!`)
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
  await fs.promises.writeFile(filePath, updatedValue.toString());

  console.log(`${name}: Buy ${num} success!`)
}

async function buyDL(use: number, name: string) {
  let lock;
  try {
    lock = await redlock.acquire(['l'], 400);
    await findAndUpdate(use, name);
  } catch (error) {
  } finally {
    if (lock) {
      await lock.release();
    }
  }
}

async function buy(use: number, name: string) {
  await findAndUpdate(use, name);
}

async function runConcurrentRequests() {
  const filePath = path.join(__dirname, `productstore.txt`);
  await fs.promises.writeFile(filePath, '10');

  const tasks = [];
  // // 10 item 
  // tasks.push(buy(6, 'Client 1'));
  // tasks.push(buy(5, 'Client 2'),);
  // tasks.push(buy(7, 'Client 3'));

  tasks.push(buyDL(6, 'Client 1'));
  tasks.push(buyDL(5, 'Client 2'),);
  tasks.push(buyDL(7, 'Client 3'));

  await Promise.all(tasks);
  console.log('All tasks completed.');
  redis.quit();
}

runConcurrentRequests();

/**
 * 
 Buy: 6
Current item in store 10
Client 1: Buy 6 success!
Buy: 5
Current item in store 4
Client 2: Buy 5 but sold out!
Buy: 7
Current item in store 4
Client 3: Buy 7 but sold out!
All tasks completed.
 */