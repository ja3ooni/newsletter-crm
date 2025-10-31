/**
 * Simple Progress Tracker for Developer Tools
 *
 * Provides progress indication for long-running operations
 */

export class ProgressTracker {
  private startTime: number;
  private current: number = 0;
  private completed: boolean = false;

  constructor(
    public readonly id: string,
    public readonly total: number,
    public readonly message?: string
  ) {
    this.startTime = Date.now();
    this.displayProgress();
  }

  public update(current: number, message?: string): void {
    if (this.completed) return;

    this.current = Math.min(current, this.total);

    if (message) {
      (this as { message?: string }).message = message;
    }

    this.displayProgress();
  }

  public increment(amount: number = 1, message?: string): void {
    this.update(this.current + amount, message);
  }

  public complete(message?: string): void {
    if (this.completed) return;

    this.current = this.total;
    this.completed = true;
    this.displayProgress(message || 'Complete');
    console.log(); // New line after completion
  }

  public fail(message?: string): void {
    if (this.completed) return;

    this.completed = true;
    this.displayProgress(message || 'Failed');
    console.log(); // New line after failure
  }

  private displayProgress(overrideMessage?: string): void {
    const percentage = Math.round((this.current / this.total) * 100);
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta =
      this.current > 0 ? Math.round((this.total - this.current) / rate) : 0;

    const progressBar = this.createProgressBar(percentage);
    const message = overrideMessage || this.message || '';
    const stats = `${this.current}/${this.total} (${percentage}%) ETA: ${eta}s`;

    // Clear line and write progress
    process.stdout.write(`\r\x1b[K${progressBar} ${stats} ${message}`);
  }

  private createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  public getStats(): {
    percentage: number;
    elapsed: number;
    rate: number;
    eta: number;
  } {
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta =
      this.current > 0 ? Math.round((this.total - this.current) / rate) : 0;
    const percentage = Math.round((this.current / this.total) * 100);

    return { percentage, elapsed, rate, eta };
  }
}
