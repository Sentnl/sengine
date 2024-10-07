import chalk from 'chalk';

export class Logger {
  static log(testType, status, message = '') {
    const statusColor = status === 'Passed' ? chalk.green : chalk.red;
    console.log(`${chalk.bold(testType)}: ${statusColor(status)} ${message}`);
  }
}